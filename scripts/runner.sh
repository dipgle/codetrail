#!/usr/bin/env bash
# runner.sh — shared file-queue command runner for multi-project Claude sandbox.
#
# WHAT IT DOES
#   Watches <project>/scripts/.cmd-queue/<id>.cmd files written by Claude.
#   Validates each command against the project's own allowlist file. If
#   allowed, evaluates it (cwd = <project>/scripts/) and writes the output
#   to <project>/scripts/.cmd-results/<id>.log. Audit trail per project.
#
# USAGE
#   runner.sh <project-root>           # explicit project root
#   RUNNER_PROJECT_ROOT=<path> runner.sh
#
# PER-PROJECT ALLOWLIST
#   <project-root>/.runner-allowlist  (one command per line)
#     # comment lines start with #
#     # blank lines ignored
#     [exact]
#     cargo build
#     cargo test
#     [prefix]
#     tail
#     grep
#
# QUEUE LAYOUT (per project)
#   <project-root>/scripts/.cmd-queue/<id>.cmd     # Claude drops here
#   <project-root>/scripts/.cmd-results/<id>.log   # daemon writes here
#   <project-root>/scripts/.cmd-results/audit.log  # append-only audit
#   <project-root>/scripts/.cmd-results/daemon.log # daemon stdout/stderr (if via launchd)
#
# RELOAD
#   Allowlist loaded once at start. Edit allowlist → kill + restart daemon
#   (launchd KeepAlive=true restarts automatically within ~10s).

set -u

# ── resolve project root ─────────────────────────────────────────────
PROJECT_ROOT="${1:-${RUNNER_PROJECT_ROOT:-}}"
if [[ -z "$PROJECT_ROOT" ]]; then
  echo "ERROR: pass project root as \$1 or set RUNNER_PROJECT_ROOT" >&2
  exit 64
fi
# Resolve symlinks + relative paths
PROJECT_ROOT="$(cd "$PROJECT_ROOT" 2>/dev/null && pwd)"
if [[ -z "$PROJECT_ROOT" || ! -d "$PROJECT_ROOT" ]]; then
  echo "ERROR: project root does not exist: ${1:-$RUNNER_PROJECT_ROOT}" >&2
  exit 64
fi

ALLOWLIST_FILE="$PROJECT_ROOT/.runner-allowlist"
if [[ ! -f "$ALLOWLIST_FILE" ]]; then
  echo "ERROR: no allowlist at $ALLOWLIST_FILE" >&2
  exit 65
fi

# Optional per-project hooks. If present, may define `eval_cmd <cmd>` to
# override the default eval (e.g., anpha1 cd's into ../dilithium3 for
# wasm-pack builds). Sourced after allowlist parse so it can also augment
# allowlist arrays if needed.
HOOKS_FILE="$PROJECT_ROOT/.runner-hooks.sh"

# Daemon runs from <project>/scripts/ so relative paths in allowlist
# (e.g. ../Cargo.toml, ./local-stack.sh) resolve the same way the original
# anpha1 runner expected.
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
mkdir -p "$SCRIPTS_DIR"
cd "$SCRIPTS_DIR" || { echo "ERROR: cannot cd to $SCRIPTS_DIR" >&2; exit 66; }

QUEUE_DIR="$SCRIPTS_DIR/.cmd-queue"
RESULT_DIR="$SCRIPTS_DIR/.cmd-results"
mkdir -p "$QUEUE_DIR" "$RESULT_DIR"
AUDIT="$RESULT_DIR/audit.log"

# ── parse allowlist into 2 arrays ────────────────────────────────────
declare -a ALLOWLIST_EXACT=()
declare -a ALLOWLIST_PREFIX=()
section=""
while IFS= read -r line; do
  # Strip CRLF + leading/trailing whitespace
  line="${line%$'\r'}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  [[ "$line" == \#* ]] && continue
  case "$line" in
    "[exact]")  section="exact" ;;
    "[prefix]") section="prefix" ;;
    *)
      case "$section" in
        exact)  ALLOWLIST_EXACT+=("$line") ;;
        prefix) ALLOWLIST_PREFIX+=("$line") ;;
        *)      echo "WARN: line outside [exact]/[prefix] section: $line" >&2 ;;
      esac
      ;;
  esac
done < "$ALLOWLIST_FILE"

if [[ -f "$HOOKS_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$HOOKS_FILE"
fi

# Default eval — projects can override by defining `eval_cmd` in their hook.
if ! declare -F eval_cmd >/dev/null; then
  eval_cmd() { eval "$1"; }
fi

is_allowed() {
  local cmd="$1"
  local a p
  # `${arr[@]+"${arr[@]}"}` safely expands empty arrays under `set -u`
  # on macOS bash 3.2 (otherwise: "unbound variable" exit 1).
  for a in ${ALLOWLIST_EXACT[@]+"${ALLOWLIST_EXACT[@]}"}; do
    [[ "$cmd" == "$a" ]] && return 0
  done
  for p in ${ALLOWLIST_PREFIX[@]+"${ALLOWLIST_PREFIX[@]}"}; do
    [[ "$cmd" == "$p"* ]] && return 0
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
      echo "\$ $cmd"
      echo "REJECTED: command not in allowlist ($ALLOWLIST_FILE)"
      echo "exit: 126"
    } > "$result_file"
    echo "[$stamp] REJECTED: $cmd" | tee -a "$AUDIT"
    rm "$cmd_file"
    return
  fi

  {
    echo "=== id=$id @ $stamp ==="
    echo "\$ $cmd"
    echo "---"
  } > "$result_file"

  eval_cmd "$cmd" >> "$result_file" 2>&1
  local rc=$?

  {
    echo "---"
    echo "exit: $rc"
  } >> "$result_file"

  echo "[$stamp] done id=$id exit=$rc" | tee -a "$AUDIT"
  rm "$cmd_file"
}

echo "🛡  runner.sh watching $QUEUE_DIR/  — project=$PROJECT_ROOT"
echo "    EXACT allowlist: ${#ALLOWLIST_EXACT[@]} commands"
echo "    PREFIX allowlist: ${#ALLOWLIST_PREFIX[@]} patterns"
echo "    Audit: $AUDIT"
echo ""

while true; do
  shopt -s nullglob
  for f in "$QUEUE_DIR"/*.cmd; do
    run_one "$f"
  done
  shopt -u nullglob
  sleep 1
done
