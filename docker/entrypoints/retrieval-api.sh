set -eu

DB_PATH="${APP_DB_PATH:-/app/var/app.db}"
DB_DIR="$(dirname "$DB_PATH")"
mkdir -p "$DB_DIR"

until { [ -f "$DB_PATH" ] && [ -w "$DB_PATH" ]; } || { [ ! -e "$DB_PATH" ] && [ -w "$DB_DIR" ]; }; do
  echo "Waiting for SQLite database path to be writable: $DB_PATH"
  sleep 1
done

pnpm -C web db:migrate
uvicorn services.retrieval_api.app:app --host 0.0.0.0 --port 8001
