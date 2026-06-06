#!/usr/bin/env bash
# runner.sh — file-based command runner for Claude (allowlist-gated).
#
# WHY THIS EXISTS
#   Claude Code's sandbox (or a CI/remote agent runtime) may not let the
#   assistant execute shell commands directly. This script offers a host-side
#   escape hatch: Claude drops a `.cmd` file into .cmd-queue/, this daemon
#   picks it up, validates against an allowlist, executes, and writes the
#   captured stdout/stderr to .cmd-results/<id>.log for Claude to read back.
#
# USAGE
#   1. Start daemon (in a separate terminal, leave running):
#        bash runner.sh
#   2. Claude enqueues a command:
#        echo "cargo test" > .cmd-queue/run-001.cmd
#   3. Claude reads result after ~1s:
#        cat .cmd-results/run-001.log
#
# SECURITY
#   - Only commands matching ALLOWLIST_EXACT (whole-line equality) or
#     ALLOWLIST_PREFIX (prefix match) run. Anything else logs REJECTED.
#   - Edit the arrays below to add commands. Each addition widens the trust
#     boundary — review what the command could do with the daemon's privileges.
#   - The daemon runs in this script's directory (cd "$(dirname "$0")").
#     Relative paths in commands resolve from there.
#   - Audit trail: every receipt/exec/reject is appended to
#     .cmd-results/audit.log with timestamp.

set -u
cd "$(dirname "$0")"

# Commands allowed by whole-line exact match. Add yours below.
declare -a ALLOWLIST_EXACT=(
  # === Example entries (uncomment / replace with your project's commands) ===
  # "npm test"
  # "npm run build"
  # "npx tsc --noEmit"
  # "cargo build"
  # "cargo test"
  # "pytest -q"
  # "make check"
)

# Commands allowed by prefix match. Useful for read-only utilities + tools
# whose argument list is variable (grep patterns, file paths, etc.).
declare -a ALLOWLIST_PREFIX=(
  # === Example entries ===
  # "tail "
  # "head "
  # "grep "
  # "wc "
  # "ls "
  # "cat docs/"
  # "curl -sS http://localhost:"
)

QUEUE_DIR=".cmd-queue"
RESULT_DIR=".cmd-results"
mkdir -p "$QUEUE_DIR" "$RESULT_DIR"
AUDIT="$RESULT_DIR/audit.log"

is_allowed() {
  local cmd="$1"
  # The `${arr[@]+"${arr[@]}"}` idiom safely expands empty arrays under `set -u`
  # on macOS's stock bash 3.2 (which otherwise errors with "unbound variable").
  for a in ${ALLOWLIST_EXACT[@]+"${ALLOWLIST_EXACT[@]}"}; do
    if [[ "$cmd" == "$a" ]]; then
      return 0
    fi
  done
  for p in ${ALLOWLIST_PREFIX[@]+"${ALLOWLIST_PREFIX[@]}"}; do
    if [[ "$cmd" == "$p"* ]]; then
      return 0
    fi
  done
  return 1
}

run_one() {
  local cmd_file="$1"
  local id; id="$(basename "$cmd_file" .cmd)"
  local cmd; cmd="$(head -n1 "$cmd_file")"
  local result_file="$RESULT_DIR/$id.log"
  local stamp; stamp="$(date '+%Y-%m-%d %H:%M:%S')"

  echo "[$stamp] received: $cmd (id=$id)" | tee -a "$AUDIT"

  if ! is_allowed "$cmd"; then
    {
      echo "=== id=$id @ $stamp ==="
      echo "$ $cmd"
      echo "REJECTED: command not in allowlist"
      echo "exit: 126"
    } > "$result_file"
    echo "[$stamp] REJECTED: $cmd" | tee -a "$AUDIT"
    rm "$cmd_file"
    return
  fi

  {
    echo "=== id=$id @ $stamp ==="
    echo "$ $cmd"
    echo "---"
  } > "$result_file"

  eval "$cmd" >> "$result_file" 2>&1
  local rc=$?

  {
    echo "---"
    echo "exit: $rc"
  } >> "$result_file"

  echo "[$stamp] done id=$id exit=$rc" | tee -a "$AUDIT"
  rm "$cmd_file"
}

echo "runner.sh watching $QUEUE_DIR/  — Ctrl+C to stop"
echo "    EXACT allowlist:  ${#ALLOWLIST_EXACT[@]} commands"
echo "    PREFIX allowlist: ${#ALLOWLIST_PREFIX[@]} patterns"
echo "    Audit log:        $AUDIT"
echo ""

while true; do
  for f in "$QUEUE_DIR"/*.cmd; do
    [[ -f "$f" ]] || continue
    run_one "$f"
  done
  sleep 1
done
