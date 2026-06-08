#!/usr/bin/env bash
# PostToolUse hook: log WebFetch/WebSearch/ReadMcpResourceTool calls as
# 'source' events. Writes to ~/.claude/source-log.jsonl so
# question-discipline.sh can verify Claude consulted sources before asking.
#
# Why a flat JSONL instead of sqlite: works even when cwd has no devlog.
# question-discipline.sh reads BOTH (devlog if exists + this jsonl always).

set -u

INPUT=$(cat)
LOG="$HOME/.claude/source-log.jsonl"

python3 - "$INPUT" "$LOG" <<'PY'
import json, sys, os, time

try:
    data = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)

log_path = sys.argv[2]
tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {}) or {}

if tool_name not in ("WebFetch", "WebSearch", "ReadMcpResourceTool"):
    sys.exit(0)

identifier = (
    tool_input.get("url")
    or tool_input.get("query")
    or tool_input.get("uri")
    or "unknown"
)

record = {
    "ts": time.time(),
    "session_id": data.get("session_id"),
    "cwd": data.get("cwd"),
    "tool": tool_name,
    "id": identifier,
}

try:
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
except Exception:
    pass

sys.exit(0)
PY
