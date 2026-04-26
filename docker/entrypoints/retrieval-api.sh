set -eu

pnpm -C web db:migrate
uvicorn services.retrieval_api.app:app --host 0.0.0.0 --port 8001
