set -eu

pnpm -C web db:migrate
pnpm -C web exec next start -H 0.0.0.0
