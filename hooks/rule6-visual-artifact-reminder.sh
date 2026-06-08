#!/usr/bin/env bash
# PostToolUse hook — HARD RULE #6 (REVIEW VISUAL ARTIFACTS BEFORE REPORTING DONE).
# Fires on Edit|Write|NotebookEdit. Filters internally: only emit reminder
# when the touched file is a visual artifact (svg/html/htm/pdf/png/jpg/jpeg/
# excalidraw/drawio/d2/mmd). Output goes to stderr so it surfaces as a
# transcript reminder without polluting stdout.
#
# Rule source: template/CLAUDE.md (HARD RULE #6 "REVIEW VISUAL ARTIFACTS").

set -e

input=$(cat)

path=$(printf '%s' "$input" | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    ti = data.get("tool_input") or data.get("toolInput") or {}
    print(ti.get("file_path") or ti.get("notebook_path") or "")
except Exception:
    print("")
' 2>/dev/null || true)

[ -z "$path" ] && exit 0

# Lowercase extension match (bash 3.2 portable — no ${var,,}).
lc=$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')
case "$lc" in
    *.svg|*.html|*.htm|*.pdf|*.png|*.jpg|*.jpeg|*.excalidraw|*.drawio|*.d2|*.mmd) ;;
    *) exit 0 ;;
esac

base="${path##*/}"

cat >&2 <<EOF

⚠ HARD RULE #6 — visual artifact written: $base

Before reporting done, render-then-audit:
  a. Render to raster (SVG→qlmanage -t -s 3200, HTML→headless screenshot,
     d2→d2 in.d2 out.png, mermaid→mmdc -i in.mmd -o out.png)
  b. Strip render padding if any
  c. Split into 4–8 logical sections via PIL crop
  d. Read each crop — audit text fit, line paths, declared colors render,
     section headers, padding deliberate not accidental
  e. Document defects → fix → re-render only changed area → verify → THEN
     report done

Compile-pass ≠ visually correct. Coordinate math on paper is invisible to
5–15px errors that are obvious on screen.

EOF

exit 0
