#!/usr/bin/env sh
# The full gate the overnight preamble names, in one command.
#
#   sh scripts/visual/gate.sh [heights.json to compare against]
#
# Lint (which carries the core/ import rule), the type check, the whole suite
# (which carries the boundary tests, the byte-identical baseline check and the
# no-timers-in-core check), the build, and the guarded screen heights against
# the file given, or the baseline when none is.
set -e
cd "$(dirname "$0")/../.."
HEIGHTS="${1:-docs/visual/baseline/heights.json}"
echo "== lint"; npm run lint --silent
echo "== typecheck"; npx tsc --noEmit
echo "== test"; npx vitest run --silent 2>&1 | tail -6
echo "== build"; npm run build --silent 2>&1 | grep -E "dist/|error" || true
echo "== heights vs $HEIGHTS"; node scripts/visual/measure.mjs --compare "$HEIGHTS" | tail -3
echo "== gate green"
