#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export WORKBOARD_DB_NAME=workboard_test
export WORKBOARD_DB_PORT=${WORKBOARD_TEST_DB_PORT:-55463}
export PORT=${WORKBOARD_TEST_API_PORT:-35463}
export HOST=127.0.0.1
export WORKBOARD_TEST_API_URL="http://127.0.0.1:$PORT"
export WORKBOARD_TEST_DATABASE_URL="postgresql://workboard:workboard@127.0.0.1:$WORKBOARD_DB_PORT/workboard_test"
export DATABASE_URL=$WORKBOARD_TEST_DATABASE_URL
export WORKBOARD_SEED_PROFILE=compact
export DEMO_ORIGIN=${WORKBOARD_TEST_APP_ORIGIN:-http://127.0.0.1:3201}
project="workboard-api-test-$$"
log=$(mktemp)
override=$(mktemp)
cat > "$override" <<'EOF'
services:
  db:
    volumes:
      - test-db:/var/lib/postgresql
volumes:
  test-db:
EOF
compose=(docker compose -p "$project" -f compose.dev.yml -f "$override")

# The project-scoped volume keeps fixture resets away from the development data.
cleanup() {
  if [[ -n ${api_pid:-} ]]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  "${compose[@]}" down -v
  unlink "$override"
  unlink "$log"
}
trap cleanup EXIT

"${compose[@]}" up -d --wait
pnpm --filter @workboard/api db:migrate
pnpm --filter @workboard/api test:database
node apps/api/dist/main.js > "$log" 2>&1 &
api_pid=$!
if ! curl --fail --retry 10 --retry-all-errors --retry-delay 1 --max-time 3 --silent "$WORKBOARD_TEST_API_URL/api/health/ready"; then
  cat "$log"
  exit 1
fi

for suite in session reads access grouping writes; do
  pnpm --filter @workboard/api "test:$suite" || { cat "$log"; exit 1; }
done
