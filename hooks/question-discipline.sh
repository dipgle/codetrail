#!/usr/bin/env bash
# Stop hook: flag when Claude asks a question without consulting sources first.
#
# Backs HARD RULE: question discipline (4-step research before asking).
# Source check reads from TWO places (any one is sufficient):
#   1. <cwd>/logs/devlog.sqlite — events WHERE kind='source' AND ts > now-30min
#   2. ~/.claude/source-log.jsonl — appended by log-source-tools.sh on every
#      WebFetch / WebSearch / ReadMcpResourceTool call
#
# Exit codes: 0 = ok, 2 = feedback to Claude (non-blocking remind)

set -u

INPUT=$(cat)

RESULT=$(python3 - "$INPUT" <<'PY'
import json, sys, re, os, sqlite3, time
from datetime import datetime, timedelta

try:
    data = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)

transcript = data.get("transcript_path") or ""
cwd = data.get("cwd") or ""

if not transcript or not os.path.exists(transcript):
    sys.exit(0)

last_assistant_text = ""
try:
    with open(transcript, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except Exception:
                continue
            t = msg.get("type") or msg.get("role")
            if t == "assistant":
                m = msg.get("message", msg)
                content = m.get("content")
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            last_assistant_text = block.get("text", "")
                elif isinstance(content, str):
                    last_assistant_text = content
except Exception:
    sys.exit(0)

if not last_assistant_text:
    sys.exit(0)

tail = last_assistant_text[-600:]

# Explicit preference-call framing — bypass (Claude already declared no objective answer)
preference_markers = [
    r"preference call",
    r"không có (đáp án|câu trả lời) objective",
    r"đây là (preference|sở thích)",
    r"tùy bạn",
    r"both .* are (valid|fine)",
]
if any(re.search(p, tail, re.IGNORECASE) for p in preference_markers):
    sys.exit(0)

question_patterns = [
    r"\?$",
    r"\?\s*$",
    r"đúng không\?",
    r"có (được|đúng|ổn|hợp lý) không\?",
    r"OK (với|không)",
    r"bạn (chọn|muốn|nghĩ)",
    r"hay (là|bạn)",
    r"có nên",
    r"should (we|I)",
    r"do you want",
    r"which (one|approach|option)",
]
has_question = any(re.search(p, tail, re.IGNORECASE | re.MULTILINE) for p in question_patterns)

if not has_question:
    sys.exit(0)

cutoff_dt = datetime.utcnow() - timedelta(minutes=30)
cutoff_iso = cutoff_dt.isoformat()
cutoff_ts = cutoff_dt.timestamp()

source_count = 0

devlog = os.path.join(cwd, "logs", "devlog.sqlite")
if os.path.exists(devlog):
    try:
        con = sqlite3.connect(devlog)
        cur = con.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM events WHERE kind='source' AND ts > ?",
            (cutoff_iso,)
        )
        source_count += cur.fetchone()[0]
        con.close()
    except Exception:
        pass

src_log = os.path.expanduser("~/.claude/source-log.jsonl")
if os.path.exists(src_log):
    try:
        with open(src_log, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    if rec.get("ts", 0) > cutoff_ts:
                        source_count += 1
                except Exception:
                    continue
    except Exception:
        pass

if source_count == 0:
    msg = (
        "QUESTION_DISCIPLINE_VIOLATION: Last turn asked the user a question, "
        "but no source consultations (kind=source in devlog, or WebFetch/"
        "WebSearch/ReadMcpResource in last 30 min) were found. "
        "Before asking, exhaust: (1) read project data, (2) check docs, "
        "(3) search code for prior art, (4) consult external sources. "
        "If the question is truly a preference call (no objective answer), "
        "say so explicitly with the phrase 'preference call' or 'tùy bạn'."
    )
    print(msg, file=sys.stderr)
    sys.exit(2)

sys.exit(0)
PY
)

exit $?
