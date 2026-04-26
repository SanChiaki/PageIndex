set -eu

pnpm -C web db:migrate
python -m services.directory_watcher.worker
