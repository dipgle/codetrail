#!/usr/bin/env bash
# PostToolUse hook: log Edit/Write/NotebookEdit as kind=artifact in nearest devlog.sqlite.
#
# Why: Claude regularly forgets to call log_event after editing files (CLAUDE.md
# HARD RULE #1 violated even in init-project itself). This hook removes the
# "remember to log" requirement — every file write is auto-recorded.
#
# Discovery rule: walk up from the edited file's directory until logs/devlog.sqlite
# is found. If none → silent no-op (file outside any adopted project).
#
# Failure mode: print to stderr (visible in Claude Code transcript) but never
# block the tool (exit 0 always).

set -u

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 - <<'PY'
import json, os, sqlite3, subprocess, sys, datetime

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {}) or {}
session_id = data.get("session_id", "")

# Only fire for file-writing tools
if tool_name not in ("Edit", "Write", "NotebookEdit"):
    sys.exit(0)

# Extract the path being written
path = (
    tool_input.get("file_path")
    or tool_input.get("notebook_path")
    or ""
)
if not path:
    sys.exit(0)

# Walk up from file's dir to find nearest logs/devlog.sqlite
start = os.path.dirname(os.path.abspath(path))
devlog = None
cur = start
while True:
    candidate = os.path.join(cur, "logs", "devlog.sqlite")
    if os.path.isfile(candidate):
        devlog = candidate
        break
    parent = os.path.dirname(cur)
    if parent == cur:
        break
    cur = parent

if not devlog:
    sys.exit(0)

# Compute relative path within project for readability
project_root = os.path.dirname(os.path.dirname(devlog))
try:
    rel = os.path.relpath(path, project_root)
except Exception:
    rel = path

ts = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

try:
    conn = sqlite3.connect(devlog, timeout=2.0)
    conn.execute("PRAGMA busy_timeout = 2000")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        "INSERT INTO events (ts, kind, actor, ref_type, ref_id, content) "
        "VALUES (?, 'artifact', 'assistant', 'file', ?, ?)",
        (ts, rel, f"{tool_name}: {rel}"),
    )
    conn.commit()
    conn.close()
except Exception as e:
    # Never block tool execution; print to stderr for transcript visibility
    print(f"[devlog-artifact] {devlog} write failed: {e}", file=sys.stderr)

sys.exit(0)
PY
