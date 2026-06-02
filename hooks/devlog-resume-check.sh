#!/usr/bin/env bash
# SessionStart hook: detect stale devlog vs filesystem mtime.
#
# Why: Claude resumes by reading memory/active-context.md but that file decays
# fast — recent code changes that weren't logged leave the resume narrative
# wrong. This hook surfaces the gap directly into the session prompt so Claude
# can't miss it.
#
# Detection:
#   - cwd has logs/devlog.sqlite → check it; else silent no-op
#   - find newest source file mtime (skip node_modules/target/.git/dist/build)
#   - compare with MAX(ts) in events
#   - if file mtime > last_event by > 1h OR devlog empty + cwd non-trivial:
#       emit warning into additionalContext
#
# Output: SessionStart additionalContext, or nothing.

set -u

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 - <<'PY'
import json, os, sqlite3, subprocess, sys, datetime, time

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

cwd = data.get("cwd", "")
source = data.get("source", "")

# Only fire on fresh session starts (not resume/clear/compact)
if source != "startup":
    sys.exit(0)

if not cwd or not os.path.isdir(cwd):
    sys.exit(0)

devlog = os.path.join(cwd, "logs", "devlog.sqlite")
if not os.path.isfile(devlog):
    sys.exit(0)

# Find newest mtime of source-ish files
SKIP_DIRS = {"node_modules", "target", ".git", "dist", "build",
             ".next", ".venv", "venv", "__pycache__", ".tmp", "logs"}
SKIP_PREFIX = "."  # skip dotfiles at the top scan level too (DS_Store, etc.)

newest_mtime = 0
newest_file = ""
try:
    for root, dirs, files in os.walk(cwd):
        # prune
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for f in files:
            if f.startswith("."):
                continue
            p = os.path.join(root, f)
            try:
                m = os.path.getmtime(p)
                if m > newest_mtime:
                    newest_mtime = m
                    newest_file = p
            except Exception:
                continue
except Exception:
    pass

# Read last event ts from devlog
last_event_ts = None
event_count = 0
try:
    conn = sqlite3.connect(devlog, timeout=2.0)
    conn.execute("PRAGMA busy_timeout = 2000")
    row = conn.execute("SELECT COUNT(*), MAX(ts) FROM events").fetchone()
    if row:
        event_count = row[0] or 0
        last_event_ts = row[1]
    conn.close()
except Exception:
    sys.exit(0)

def parse_iso(s):
    if not s:
        return None
    try:
        # tolerate trailing Z
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.datetime.fromisoformat(s).timestamp()
    except Exception:
        return None

last_event_epoch = parse_iso(last_event_ts) if last_event_ts else None

# Decide whether to warn
warning = None
gap_hours = None

if newest_mtime > 0:
    if event_count == 0:
        rel = os.path.relpath(newest_file, cwd) if newest_file else "(unknown)"
        age_h = (time.time() - newest_mtime) / 3600
        warning = (
            f"⚠ Devlog has 0 events but project contains source files "
            f"(newest: {rel}, modified {age_h:.1f}h ago).\n"
            f"   → Prior work was done WITHOUT logging. "
            f"`memory/active-context.md` may be the only narrative — "
            f"treat with skepticism and reconcile before acting on it."
        )
    elif last_event_epoch:
        gap_sec = newest_mtime - last_event_epoch
        gap_hours = gap_sec / 3600
        if gap_hours > 1:
            rel = os.path.relpath(newest_file, cwd) if newest_file else "(unknown)"
            warning = (
                f"⚠ Devlog stale: last event {gap_hours:.1f}h before newest "
                f"file change.\n"
                f"   Last event:  {last_event_ts}\n"
                f"   Newest file: {rel} ({datetime.datetime.fromtimestamp(newest_mtime).isoformat(timespec='seconds')})\n"
                f"   → Code changed without log_event. Resume narrative likely "
                f"incomplete; check git log / file diffs before trusting "
                f"`memory/active-context.md`."
            )

if not warning:
    sys.exit(0)

out = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": warning,
    }
}
print(json.dumps(out))
PY
