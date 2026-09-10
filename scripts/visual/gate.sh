#!/usr/bin/env sh
# The full gate the overnight preamble names, in one command.
#
#   sh scripts/visual/gate.sh [heights.json to compare against]
#
# Lint (which carries the core/ import rule), the type check, the whole suite
# (which carries the boundary tests, the byte-identical baseline check and the
# no-timers-in-core check), the build, and the guarded screen heights against
# the file given, or the baseline when none is.
#
# Every step's exit status is checked directly. A `cmd | tail` pipeline under
# `set -e` reports tail's status, not cmd's, and the first version of this
# script said "gate green" over two failing test files because of it.
set -e
cd "$(dirname "$0")/../.."
HEIGHTS="${1:-docs/visual/baseline/heights.json}"
LOG="${TMPDIR:-/tmp}/gymrun-gate.log"
step() {
  NAME="$1"; shift
  echo "== $NAME"
  if "$@" > "$LOG" 2>&1; then
    tail -n 6 "$LOG"
  else
    echo "== $NAME FAILED"; tail -n 60 "$LOG"; exit 1
  fi
}
step lint npm run lint --silent
step typecheck npx tsc --noEmit
step test npx vitest run --silent
step build npm run build --silent
step "heights vs $HEIGHTS" node scripts/visual/measure.mjs --compare "$HEIGHTS"
echo "== gate green"
