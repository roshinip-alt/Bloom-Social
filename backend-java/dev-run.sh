#!/usr/bin/env bash
# Runs the backend without Docker or a local Postgres: an embedded PostgreSQL is started (data discarded on exit).
# Usage: ./dev-run.sh   (from backend-java/)   — see docs/local-development.md
set -euo pipefail
cd "$(dirname "$0")"
mvn -B -q test-compile
mvn -B -q dependency:build-classpath -Dmdep.outputFile=target/dev-classpath.txt -Dmdep.includeScope=test
exec java -cp "target/classes:target/test-classes:$(cat target/dev-classpath.txt)" \
  -Dbloom.public-url="${APP_PUBLIC_URL:-http://localhost:5173}" \
  -Dbloom.integration.base-url="${INTEGRATION_SERVICE_URL:-http://localhost:8090}" \
  -Dbloom.integration.internal-token="${INTERNAL_API_TOKEN:-local-dev-internal-token}" \
  com.bloom.support.LocalDevServer
