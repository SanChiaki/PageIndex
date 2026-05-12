from pathlib import Path

import pytest

from services.index_worker import office_conversion
from services.index_worker.office_conversion import OfficeConversionError, convert_office_to_pdf


class _FakeResponse:
    def __init__(self, body: bytes):
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc, _traceback):
        return False

    def read(self) -> bytes:
        return self._body


def test_convert_office_to_pdf_posts_file_to_gotenberg_and_writes_pdf(tmp_path, monkeypatch):
    source = tmp_path / "scope.docx"
    source.write_bytes(b"office body")
    converted_root = tmp_path / "converted"
    captured = {}

    monkeypatch.setattr(office_conversion, "CONVERTED_ROOT", converted_root)
    monkeypatch.setattr(office_conversion, "GOTENBERG_URL", "http://gotenberg:3000/")

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        captured["content_type"] = request.headers["Content-type"]
        captured["body"] = request.data
        return _FakeResponse(b"%PDF-1.7\nconverted")

    monkeypatch.setattr(office_conversion.urllib.request, "urlopen", fake_urlopen)

    result = convert_office_to_pdf(
        str(source),
        {"document_id": "doc_1", "content_hash": "sha256:abcdef1234567890"},
    )

    output = Path(result)
    assert output == converted_root / "doc_1-abcdef1234567890.pdf"
    assert output.read_bytes() == b"%PDF-1.7\nconverted"
    assert captured["url"] == "http://gotenberg:3000/forms/libreoffice/convert"
    assert captured["timeout"] == office_conversion.OFFICE_CONVERSION_TIMEOUT_SECONDS
    assert captured["content_type"].startswith("multipart/form-data; boundary=")
    assert b'name="files"; filename="scope.docx"' in captured["body"]
    assert b"office body" in captured["body"]


def test_convert_office_to_pdf_reuses_existing_pdf_without_calling_gotenberg(tmp_path, monkeypatch):
    source = tmp_path / "scope.docx"
    source.write_bytes(b"office body")
    converted_root = tmp_path / "converted"
    output = converted_root / "doc_1-abcdef1234567890.pdf"
    output.parent.mkdir(parents=True)
    output.write_bytes(b"%PDF-1.7\ncached")

    monkeypatch.setattr(office_conversion, "CONVERTED_ROOT", converted_root)

    def fail_urlopen(_request, _timeout):
        raise AssertionError("Gotenberg should not be called for cached conversion")

    monkeypatch.setattr(office_conversion.urllib.request, "urlopen", fail_urlopen)

    result = convert_office_to_pdf(
        str(source),
        {"document_id": "doc_1", "content_hash": "sha256:abcdef1234567890"},
    )

    assert result == str(output)
    assert output.read_bytes() == b"%PDF-1.7\ncached"


def test_convert_office_to_pdf_rejects_non_pdf_gotenberg_response(tmp_path, monkeypatch):
    source = tmp_path / "scope.docx"
    source.write_bytes(b"office body")
    monkeypatch.setattr(office_conversion, "CONVERTED_ROOT", tmp_path / "converted")
    monkeypatch.setattr(
        office_conversion.urllib.request,
        "urlopen",
        lambda _request, timeout: _FakeResponse(b"not a pdf"),
    )

    with pytest.raises(OfficeConversionError, match="non-PDF"):
        convert_office_to_pdf(str(source), {"document_id": "doc_1"})


def test_convert_office_to_pdf_retries_transient_gotenberg_connection_errors(tmp_path, monkeypatch):
    source = tmp_path / "scope.docx"
    source.write_bytes(b"office body")
    calls = {"count": 0}

    monkeypatch.setattr(office_conversion, "CONVERTED_ROOT", tmp_path / "converted")
    monkeypatch.setattr(office_conversion.time, "sleep", lambda _seconds: None)

    def flaky_urlopen(_request, timeout):
        calls["count"] += 1
        if calls["count"] == 1:
            raise office_conversion.urllib.error.URLError("connection refused")
        return _FakeResponse(b"%PDF-1.7\nconverted")

    monkeypatch.setattr(office_conversion.urllib.request, "urlopen", flaky_urlopen)

    result = convert_office_to_pdf(str(source), {"document_id": "doc_1"})

    assert Path(result).read_bytes() == b"%PDF-1.7\nconverted"
    assert calls["count"] == 2
