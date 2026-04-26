set -eu

pnpm -C web db:migrate
python -m services.index_worker.worker
