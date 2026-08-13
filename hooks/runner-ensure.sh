#!/usr/bin/env bash
# SessionStart hook: ensure the per-project runner daemon is alive.
#
# Why: `template/startup.sh` only fires once at scaffold time. After git
# clone on a new machine, or after a reboot, the project directory has its
# `.runner-allowlist` but no daemon. Claude drops `.cmd-queue/<id>.cmd`
# files that no one picks up → silent stall.
#
# This hook fixes that mechanically: on every fresh session start, if the
# cwd has `.runner-allowlist`, invoke `daemon-ctl.sh ensure <cwd>` from
# the shared codetrail scripts dir.
#
# The runner + daemon-ctl live ONCE at $CODETRAIL_HOME/scripts/ — there
# is no per-project runner copy.
#
# Behavior:
#   - source == 'startup' only (skip resume/clear/compact — daemon already
#     up from previous session unless reboot intervened)
#   - silent on success / no-op (no additionalContext to keep prompt clean)
#   - failure logged to <project>/scripts/.cmd-results/daemon.log by daemon-ctl

set -u

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

# Resolve daemon-ctl path, preferring what is KNOWN over what is guessed:
#   1. $CODETRAIL_HOME (set by install.txt).
#   2. Walk UP from cwd looking for scripts/daemon-ctl.sh or
#      AI/codetrail/scripts/daemon-ctl.sh. The session's own location tells us
#      the layout, so no assumption about anyone's home directory is needed.
#   3. ~/.codetrail — install.txt's default clone target.
#   4. $HOME guesses — last resort only. ~/Documents/... sits at the very
#      bottom on purpose: macOS TCC guards that folder and can deny reads
#      intermittently, so it must never shadow a working path above it.
walk_up_for_daemon_ctl() {
    local dir="${1:-$PWD}" cand
    while [ -n "$dir" ] && [ "$dir" != "/" ]; do
        for cand in "$dir/scripts/daemon-ctl.sh" \
                    "$dir/AI/codetrail/scripts/daemon-ctl.sh"; do
            [ -x "$cand" ] && { echo "$cand"; return 0; }
        done
        dir="$(dirname "$dir")"
    done
    return 1
}

resolve_daemon_ctl() {
    local cand
    if [ -n "${CODETRAIL_HOME:-}" ] && [ -x "$CODETRAIL_HOME/scripts/daemon-ctl.sh" ]; then
        echo "$CODETRAIL_HOME/scripts/daemon-ctl.sh"
        return 0
    fi
    walk_up_for_daemon_ctl "$PWD" && return 0
    for cand in \
        "$HOME/.codetrail/scripts/daemon-ctl.sh" \
        "$HOME/projects/scripts/daemon-ctl.sh" \
        "$HOME/projects/AI/codetrail/scripts/daemon-ctl.sh" \
        "$HOME/Documents/projects/scripts/daemon-ctl.sh" \
        "$HOME/Documents/projects/AI/codetrail/scripts/daemon-ctl.sh"
    do
        if [ -x "$cand" ]; then
            echo "$cand"
            return 0
        fi
    done
    return 1
}

DAEMON_CTL="$(resolve_daemon_ctl)" || exit 0

python3 - "$DAEMON_CTL" <<'PY'
import json, os, sys, subprocess

daemon_ctl = sys.argv[1]

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

cwd = data.get("cwd", "")
source = data.get("source", "")

if source != "startup":
    sys.exit(0)

if not cwd or not os.path.isdir(cwd):
    sys.exit(0)

# Only fire when project has an allowlist (= adopted by codetrail).
if not os.path.isfile(os.path.join(cwd, ".runner-allowlist")):
    sys.exit(0)

try:
    subprocess.run(
        [daemon_ctl, "ensure", cwd],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=10,
        check=False,
    )
except Exception:
    pass
PY
