#!/usr/bin/env bash
# SessionStart hook: detect unadopted projects, inform Claude (don't auto-adopt).
#
# Behavior: inform-only by default. Auto-adopt opt-in via env CLAUDE_AUTO_ADOPT=1.
#
# Required env (hook is a silent no-op when unset — keeps it inert for users
# who don't share the multi-project workspace pattern):
#   CLAUDE_PROJECTS_ROOT  — parent folder containing your projects
#                           (e.g. ~/Documents/projects). Hook only fires when
#                           cwd is inside this root.
#   CLAUDE_ADOPT_SCRIPT   — absolute path to a script that scaffolds a folder
#                           with the codetrail template. Typically
#                           <codetrail-clone>/template/startup.sh.
#                           When unset, hook still informs but can't run adopt.
#
# Detection criteria for the inform message:
#   - cwd lives under $CLAUDE_PROJECTS_ROOT
#   - cwd != projects root itself
#   - cwd has no .mcp.json (not yet adopted)
#   - cwd is not empty (real folder, not scratch)
#   - source == 'startup' (skip resume/clear/compact)

set -u

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 - <<'PY'
import json, sys, os, subprocess

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

cwd = data.get("cwd", "")
source = data.get("source", "")

if source != "startup":
    sys.exit(0)

projects_root_env = os.environ.get("CLAUDE_PROJECTS_ROOT", "").strip()
if not projects_root_env:
    sys.exit(0)
PROJECTS_ROOT = os.path.expanduser(projects_root_env)

if not cwd.startswith(PROJECTS_ROOT + os.sep) and cwd != PROJECTS_ROOT:
    sys.exit(0)

if cwd == PROJECTS_ROOT:
    sys.exit(0)

if os.path.exists(os.path.join(cwd, ".mcp.json")):
    sys.exit(0)

try:
    contents = [c for c in os.listdir(cwd) if c not in (".DS_Store", ".git")]
    if not contents:
        sys.exit(0)
except Exception:
    sys.exit(0)

other_ai = []
for marker in [".cursorrules", ".aider.conf.yml", ".aider.conf",
               ".continue", ".github/copilot-instructions.md"]:
    if os.path.exists(os.path.join(cwd, marker)):
        other_ai.append(marker)

has_custom_claude_md = False
claude_md = os.path.join(cwd, "CLAUDE.md")
if os.path.exists(claude_md):
    try:
        if os.path.getsize(claude_md) > 100:
            has_custom_claude_md = True
    except Exception:
        pass

adopt_script_env = os.environ.get("CLAUDE_ADOPT_SCRIPT", "").strip()
adopt_script = os.path.expanduser(adopt_script_env) if adopt_script_env else ""
auto_adopt = os.environ.get("CLAUDE_AUTO_ADOPT", "0") == "1"

if auto_adopt and adopt_script and not other_ai and not has_custom_claude_md:
    if os.path.exists(adopt_script):
        try:
            result = subprocess.run(
                [adopt_script, cwd], capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                msg = (
                    f"Auto-adopted (CLAUDE_AUTO_ADOPT=1). "
                    f"Folder {cwd} scaffolded via {adopt_script}. "
                    "Reload the IDE window to activate MCP."
                )
            else:
                msg = f"Auto-adopt failed: {result.stderr[:200]}"
        except Exception as e:
            msg = f"Auto-adopt error: {e}"
    else:
        msg = f"Auto-adopt requested but CLAUDE_ADOPT_SCRIPT not found at {adopt_script}."
else:
    lines = [
        f"📂 Folder `{cwd}` is not yet adopted (no .mcp.json).",
        "",
    ]
    if other_ai:
        lines.append(f"⚠️ Detected other AI tooling: {', '.join(other_ai)}")
        lines.append("   Adopt will coexist (won't overwrite), but verify if needed.")
        lines.append("")
    if has_custom_claude_md:
        lines.append("⚠️ Existing CLAUDE.md found (>100 bytes).")
        lines.append("   Adopt won't overwrite it — only adds missing template files.")
        lines.append("")
    lines.extend([
        "If user wants to scaffold this folder with the codetrail template",
        "(adds CLAUDE.md, docs/, memory/, logs/devlog.sqlite, .mcp.json):",
        "",
        "  1. ASK USER: 'Adopt folder X to enable MCP devlog + TDD workflow?'",
        "  2. If yes → run the codetrail adopt script:",
        f"     {adopt_script or '<set CLAUDE_ADOPT_SCRIPT env to point at codetrail/template/startup.sh>'} <cwd>",
        "  3. Then tell user to reload the IDE window to activate MCP",
        "",
        "If user just wants to use Claude on this folder without devlog,",
        "skip adoption entirely — Claude works fine without MCP project-agent.",
    ])
    msg = "\n".join(lines)

out = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": msg,
    }
}
print(json.dumps(out))
PY
