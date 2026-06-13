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

# Resolve daemon-ctl path. Priority:
#   1. $CODETRAIL_HOME (set by install.txt) → $CODETRAIL_HOME/scripts/daemon-ctl.sh
#   2. ~/.codetrail/scripts/daemon-ctl.sh        (install.txt default home)
#   3. ~/Documents/projects/scripts/daemon-ctl.sh (legacy root layout)
resolve_daemon_ctl() {
    local cand
    for cand in \
        "${CODETRAIL_HOME:-}/scripts/daemon-ctl.sh" \
        "$HOME/.codetrail/scripts/daemon-ctl.sh" \
        "$HOME/Documents/projects/scripts/daemon-ctl.sh" \
        "$HOME/Documents/projects/AI/codetrail/scripts/daemon-ctl.sh"
    do
        if [ -n "$cand" ] && [ -x "$cand" ]; then
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
