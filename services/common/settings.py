from pathlib import Path
import os


REPO_ROOT = Path(__file__).resolve().parents[2]
VAR_ROOT = Path(os.getenv("APP_VAR_ROOT", REPO_ROOT / "var"))
DB_PATH = Path(os.getenv("APP_DB_PATH", VAR_ROOT / "app.db"))
UPLOAD_ROOT = Path(os.getenv("APP_UPLOAD_ROOT", VAR_ROOT / "uploads"))
