from services.retrieval_api.select_documents import (
    keyword_score,
    prefilter_candidate_documents,
    select_candidate_documents,
)


def test_keyword_score_prefers_matching_description():
    query = "cash flow risk"
    doc = {
        "id": "doc_1",
        "project_id": "proj_1",
        "file_name": "alpha.pdf",
        "doc_description": "Cash flow risk factors and debt covenants",
    }

    assert keyword_score(query, doc) > 0


def test_keyword_score_matches_project_relative_path():
    doc = {
        "id": "doc_1",
        "project_id": "proj_1",
        "file_name": "report.pdf",
        "project_name": "Alpha",
        "project_relative_path": "delivery/acceptance/report.pdf",
        "source_relative_path": "Alpha/delivery/acceptance/report.pdf",
        "doc_description": "Network delivery evidence.",
    }

    assert keyword_score("acceptance handover", doc) > 0


def test_keyword_score_matches_pageindex_structure_title():
    doc = {
        "id": "doc_1",
        "project_id": "proj_1",
        "file_name": "report.pdf",
        "doc_description": "Network delivery evidence.",
        "structure": [
            {
                "title": "终验交付报告",
                "summary": "包含割接结果、质检结论和遗留事项。",
            }
        ],
    }

    assert keyword_score("生成终验报告", doc) > 0


def test_prefilter_candidate_documents_removes_unrelated_documents_before_llm():
    docs = [
        {
            "id": f"doc_noise_{index}",
            "project_id": "proj_1",
            "file_name": f"finance-{index}.pdf",
            "project_name": "Finance",
            "project_relative_path": f"finance/{index}.pdf",
            "source_relative_path": f"Finance/finance/{index}.pdf",
            "doc_description": "Quarterly financial statements and market discussion.",
        }
        for index in range(60)
    ]
    docs.extend(
        [
            {
                "id": "doc_handover",
                "project_id": "proj_2",
                "file_name": "handover-report.pdf",
                "project_name": "Alpha",
                "project_relative_path": "delivery/handover-report.pdf",
                "source_relative_path": "Alpha/delivery/handover-report.pdf",
                "doc_description": "Final acceptance handover report and sign-off checklist.",
            },
            {
                "id": "doc_quality",
                "project_id": "proj_2",
                "file_name": "quality-check.pdf",
                "project_name": "Alpha",
                "project_relative_path": "delivery/quality-check.pdf",
                "source_relative_path": "Alpha/delivery/quality-check.pdf",
                "doc_description": "Quality inspection evidence for final delivery.",
            },
        ]
    )

    selected = prefilter_candidate_documents("生成终验交付报告", docs, limit=10)

    assert [doc["id"] for doc in selected] == ["doc_handover", "doc_quality"]


def test_prefilter_does_not_match_latin_query_expansions_inside_other_words():
    docs = [
        {
            "id": "doc_design",
            "project_id": "proj_1",
            "project_name": "office-test",
            "file_name": "detailed-design-report.pdf",
            "project_relative_path": "design/detailed-design-report.pdf",
            "source_relative_path": "office-test/design/detailed-design-report.pdf",
            "doc_description": "Architecture design report and implementation notes.",
        },
        {
            "id": "doc_annual",
            "project_id": "proj_1",
            "project_name": "office-test",
            "file_name": "annual-report.pdf",
            "project_relative_path": "annual-report.pdf",
            "source_relative_path": "office-test/annual-report.pdf",
            "doc_description": "Annual business report and market discussion.",
            "structure": [{"title": "Delivery of shareholder documents"}],
        },
        {
            "id": "doc_handover",
            "project_id": "proj_2",
            "project_name": "Alpha",
            "file_name": "final-acceptance-handover.pdf",
            "project_relative_path": "delivery/final-acceptance-handover.pdf",
            "source_relative_path": "Alpha/delivery/final-acceptance-handover.pdf",
            "doc_description": "Final acceptance handover report and sign-off checklist.",
        },
    ]

    selected = prefilter_candidate_documents("生成终验交付报告", docs, limit=10)

    assert [doc["id"] for doc in selected] == ["doc_handover"]


def test_select_candidate_documents_limits_results():
    docs = [
        {
            "id": f"doc_{index}",
            "project_id": "proj_1",
            "file_name": f"doc-{index}.pdf",
            "doc_description": "cash flow risk" if index < 3 else "unrelated",
        }
        for index in range(10)
    ]

    selected = select_candidate_documents("cash flow risk", docs, limit=2)
    assert len(selected) == 2


def test_select_candidate_documents_uses_llm_description_selection(monkeypatch):
    docs = [
        {
            "id": "doc_scope",
            "project_id": "proj_1",
            "project_name": "Alpha",
            "file_name": "project-scope.pdf",
            "project_relative_path": "planning/project-scope.pdf",
            "source_relative_path": "Alpha/planning/project-scope.pdf",
            "doc_description": "Project scope, milestones, and staffing plan.",
        },
        {
            "id": "doc_acceptance",
            "project_id": "proj_1",
            "project_name": "Alpha",
            "file_name": "acceptance-criteria.pdf",
            "project_relative_path": "delivery/acceptance-criteria.pdf",
            "source_relative_path": "Alpha/delivery/acceptance-criteria.pdf",
            "doc_description": "Acceptance criteria, completion checklist, and review standards.",
        },
    ]

    def fake_llm_completion(model, prompt, chat_history=None, return_finish_reason=False):
        assert model == "gpt-retrieval"
        assert "这个项目的验收标准是什么？" in prompt
        assert "acceptance-criteria.pdf" in prompt
        assert "delivery/acceptance-criteria.pdf" in prompt
        assert "Alpha/delivery/acceptance-criteria.pdf" in prompt
        return '{"thinking":"doc_acceptance matches acceptance criteria","answer":["doc_acceptance"]}'

    monkeypatch.setattr("pageindex.utils.llm_completion", fake_llm_completion)

    selected = select_candidate_documents(
        "这个项目的验收标准是什么？",
        docs,
        limit=2,
        model="gpt-retrieval",
    )

    assert [doc["id"] for doc in selected] == ["doc_acceptance"]


def test_select_candidate_documents_sends_prefiltered_candidates_to_llm(monkeypatch):
    docs = [
        {
            "id": f"doc_noise_{index}",
            "project_id": "proj_1",
            "project_name": "Finance",
            "file_name": f"finance-{index}.pdf",
            "project_relative_path": f"finance/{index}.pdf",
            "source_relative_path": f"Finance/finance/{index}.pdf",
            "doc_description": "Quarterly financial statements and market discussion.",
        }
        for index in range(60)
    ]
    docs.append(
        {
            "id": "doc_acceptance",
            "project_id": "proj_2",
            "project_name": "Alpha",
            "file_name": "final-acceptance-handover.pdf",
            "project_relative_path": "delivery/final-acceptance-handover.pdf",
            "source_relative_path": "Alpha/delivery/final-acceptance-handover.pdf",
            "doc_description": "Final acceptance handover report and delivery checklist.",
        }
    )

    def fake_llm_completion(model, prompt, chat_history=None, return_finish_reason=False):
        assert "final-acceptance-handover.pdf" in prompt
        assert "finance-0.pdf" not in prompt
        assert "finance-59.pdf" not in prompt
        return '{"thinking":"acceptance handover matches","answer":["doc_acceptance"]}'

    monkeypatch.setattr("pageindex.utils.llm_completion", fake_llm_completion)

    selected = select_candidate_documents(
        "生成终验交付报告",
        docs,
        limit=5,
        model="gpt-retrieval",
    )

    assert [doc["id"] for doc in selected] == ["doc_acceptance"]


def test_select_candidate_documents_falls_back_to_keywords_when_llm_response_is_invalid(
    monkeypatch,
):
    docs = [
        {
            "id": "doc_1",
            "project_id": "proj_1",
            "file_name": "cash-flow.pdf",
            "doc_description": "Cash flow risk factors and debt covenants",
        },
        {
            "id": "doc_2",
            "project_id": "proj_1",
            "file_name": "staffing.pdf",
            "doc_description": "Team roster and roles",
        },
    ]

    monkeypatch.setattr(
        "pageindex.utils.llm_completion",
        lambda model, prompt, chat_history=None, return_finish_reason=False: "not-json",
    )

    selected = select_candidate_documents(
        "cash flow risk",
        docs,
        limit=2,
        model="gpt-retrieval",
    )

    assert [doc["id"] for doc in selected] == ["doc_1"]


def test_select_candidate_documents_falls_back_to_weak_matches_when_no_strong_match(
    monkeypatch,
):
    docs = [
        {
            "id": "doc_annual",
            "project_id": "proj_1",
            "project_name": "office-test",
            "file_name": "annual-report.pdf",
            "doc_description": "Annual business report and market discussion.",
        }
    ]

    monkeypatch.setattr(
        "pageindex.utils.llm_completion",
        lambda model, prompt, chat_history=None, return_finish_reason=False: "not-json",
    )

    selected = select_candidate_documents(
        "生成终验交付报告",
        docs,
        limit=2,
        model="gpt-retrieval",
    )

    assert [doc["id"] for doc in selected] == ["doc_annual"]
