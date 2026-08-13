#!/usr/bin/env bash
# Regression lock for runner.sh's allowlist matching and command isolation.
#
# Usage:  bash scripts/test-runner.sh                  # exit 0 = all pass
#         RUNNER=/path/to/other/runner.sh bash scripts/test-runner.sh
#
# The RUNNER override exists so this suite can be pointed at a deliberately
# broken copy to confirm it still goes RED. A regression lock that has never
# failed is a regression lock nobody has verified.
#
# Runs the REAL runner.sh against a throwaway project under $TMPDIR — never
# against a project you care about, and never inside this repo. Every case
# below corresponds to a defect that shipped at least once:
#
#   allowed        a plain [prefix] entry must still run (guard against a fix
#                  that rejects everything and looks green)
#   injection      `ls; echo PWNED` matched the `ls` prefix and eval ran the
#                  tail as its own command — arbitrary execution with the
#                  DEFAULT shipped allowlist
#   compound-entry an allowlist line that legitimately contains && must keep
#                  working; the injection guard inspects only the tail AFTER
#                  the matched prefix, so this is the case that proves the
#                  guard is scoped and not just blanket-banning metacharacters
#   cwd-isolation  a command containing `cd` moved the daemon's cwd for good,
#                  so every later command resolved relative paths elsewhere —
#                  silent, order-dependent, and the reason a working script
#                  started returning exit 127 half an hour later
#   unlisted       a command matching nothing is rejected
#
# Add a case here whenever a runner defect is found. A fix without a case is
# a fix that comes back.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="${RUNNER:-$SCRIPT_DIR/runner.sh}"
[ -x "$RUNNER" ] || [ -f "$RUNNER" ] || { echo "FATAL: no runner.sh at $RUNNER" >&2; exit 70; }

WORK="$(mktemp -d)"
PROJ="$WORK/p"
QUEUE="$PROJ/scripts/.cmd-queue"
RESULTS="$PROJ/scripts/.cmd-results"
DAEMON_PID=""

cleanup() {
    if [ -n "$DAEMON_PID" ]; then
        # `wait` reaps the job so bash does not print "Terminated: 15" over the
        # test summary. The daemon may already be gone; either way, ignore.
        { kill "$DAEMON_PID"; wait "$DAEMON_PID"; } 2>/dev/null
    fi
    rm -rf "$WORK"   # never leave the throwaway project behind
}
trap cleanup EXIT

mkdir -p "$PROJ/scripts"
cat > "$PROJ/.runner-allowlist" <<'ALLOWLIST'
[exact]
pwd
[prefix]
ls
cd /tmp && pwd
ALLOWLIST

bash "$RUNNER" "$PROJ" > "$WORK/daemon.log" 2>&1 &
DAEMON_PID=$!

# Wait for the daemon to finish parsing the allowlist and start polling.
for _ in $(seq 1 30); do
    [ -d "$QUEUE" ] && grep -q "watching" "$WORK/daemon.log" 2>/dev/null && break
    sleep 0.2
done
if ! kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo "FATAL: daemon died on startup:" >&2
    cat "$WORK/daemon.log" >&2
    exit 70
fi

FAILURES=0
CASES=0

# Enqueue one command and block until the daemon has written a terminal result.
# Returns the result body on stdout. Fails loudly rather than returning empty.
run_cmd() {
    local id="$1" cmd="$2" i
    printf '%s\n' "$cmd" > "$QUEUE/$id.cmd"
    for ((i = 0; i < 100; i++)); do
        if [ -f "$RESULTS/$id.log" ] && grep -q '^exit:' "$RESULTS/$id.log"; then
            cat "$RESULTS/$id.log"
            return 0
        fi
        sleep 0.1
    done
    echo "TIMEOUT: no result for id=$id after 10s" >&2
    return 1
}

check() {
    local name="$1" mode="$2" needle="$3" body="$4"
    CASES=$((CASES + 1))
    case "$mode" in
        has)
            if printf '%s' "$body" | grep -qF -- "$needle"; then
                echo "  ok   $name — found '$needle'"
            else
                echo "  FAIL $name — expected to find '$needle' in:"
                printf '%s\n' "$body" | sed 's/^/         /'
                FAILURES=$((FAILURES + 1))
            fi
            ;;
        lacks)
            if printf '%s' "$body" | grep -qF -- "$needle"; then
                echo "  FAIL $name — expected NOT to find '$needle' in:"
                printf '%s\n' "$body" | sed 's/^/         /'
                FAILURES=$((FAILURES + 1))
            else
                echo "  ok   $name — absent '$needle'"
            fi
            ;;
        lacks-line)
            # Whole-line match. A rejected command is ECHOED BACK into the
            # result and the audit log on purpose, so a substring search for
            # the payload always hits and can never fail — a blind assertion.
            # Command OUTPUT, by contrast, lands on its own line, which is
            # exactly what must be absent when the command never ran.
            if printf '%s' "$body" | grep -qxF -- "$needle"; then
                echo "  FAIL $name — '$needle' appears as output, so it EXECUTED:"
                printf '%s\n' "$body" | sed 's/^/         /'
                FAILURES=$((FAILURES + 1))
            else
                echo "  ok   $name — '$needle' never appears as output"
            fi
            ;;
    esac
}

echo "runner.sh regression lock — project=$PROJ"
echo ""

echo "[allowed] a plain [prefix] entry runs"
BODY="$(run_cmd t1 'ls')" || exit 1
check "allowed/exit" has "exit: 0" "$BODY"

echo "[injection] tail after a matched prefix must not execute"
BODY="$(run_cmd t2 'ls; echo PWNED')" || exit 1
check "injection/rejected" has "REJECTED"  "$BODY"
check "injection/exit"     has "exit: 126" "$BODY"
check "injection/no-exec"  lacks-line "PWNED" "$BODY"

echo "[compound-entry] an allowlist line containing && still runs"
BODY="$(run_cmd t3 'cd /tmp && pwd')" || exit 1
check "compound/exit"   has "exit: 0" "$BODY"
check "compound/output" has "/tmp"    "$BODY"

echo "[cwd-isolation] the next command starts from <project>/scripts again"
BODY="$(run_cmd t4 'pwd')" || exit 1
check "cwd/exit"      has   "exit: 0"          "$BODY"
check "cwd/restored"  has   "$PROJ/scripts"    "$BODY"

echo "[unlisted] a command matching no line is rejected"
BODY="$(run_cmd t5 'whoami')" || exit 1
check "unlisted/rejected" has "REJECTED"  "$BODY"
check "unlisted/exit"     has "exit: 126" "$BODY"

echo ""
if [ "$FAILURES" -eq 0 ]; then
    echo "PASS — $CASES assertions, 0 failed"
    exit 0
fi
echo "FAIL — $CASES assertions, $FAILURES failed"
exit 1
