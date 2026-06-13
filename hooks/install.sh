#!/usr/bin/env bash
# install.sh — install codetrail hooks into ~/.claude/hooks/ and register them
# in ~/.claude/settings.json. Idempotent: safe to re-run, never duplicates
# entries, never overwrites unrelated keys.
#
# Usage:
#   bash hooks/install.sh           # install all hooks
#   bash hooks/install.sh --dry-run # show what would change
#   bash hooks/install.sh --force   # overwrite hook files even if newer
#
# What it touches:
#   ~/.claude/hooks/<hook>.sh   — copied from this repo, chmod +x
#   ~/.claude/settings.json     — hook entries added under .hooks.<event>[].hooks[]
#
# What it preserves:
#   Any existing key in settings.json (permissions, theme, env, etc.)
#   Any unrelated hook entry already registered for a matcher

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOME_CLAUDE="$HOME/.claude"
HOOKS_DEST="$HOME_CLAUDE/hooks"
SETTINGS="$HOME_CLAUDE/settings.json"

DRY_RUN=0
FORCE=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --force)   FORCE=1 ;;
        -h|--help)
            sed -n '2,20p' "$0"
            exit 0
            ;;
        *) echo "unknown arg: $arg" >&2; exit 2 ;;
    esac
done

# Mapping of (hook file) -> (event, matcher). Events follow Claude Code's hook
# schema: UserPromptSubmit / SessionStart / PreToolUse / PostToolUse / Stop.
HOOK_SPECS=(
    "cred-scrubber.sh|UserPromptSubmit|"
    "auto-adopt.sh|SessionStart|startup"
    "devlog-resume-check.sh|SessionStart|startup"
    "runner-ensure.sh|SessionStart|startup"
    "cred-pre-tool.sh|PreToolUse|Read|Bash"
    "log-source-tools.sh|PostToolUse|WebFetch|WebSearch|ReadMcpResourceTool"
    "devlog-artifact.sh|PostToolUse|Edit|Write|NotebookEdit"
    "rule6-visual-artifact-reminder.sh|PostToolUse|Edit|Write|NotebookEdit"
    "cred-post-tool.sh|PostToolUse|Read|Bash|Grep|mcp__"
    "question-discipline.sh|Stop|"
)

VAULT_GET="vault-get.sh"  # helper script — copied but not registered

run() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "DRY  $*"
    else
        eval "$@"
    fi
}

echo "==> codetrail hook install"
echo "    repo hooks: $SCRIPT_DIR"
echo "    destination: $HOOKS_DEST"
echo "    settings:    $SETTINGS"
echo "    dry-run:     $DRY_RUN"
echo "    force:       $FORCE"
echo

# ---- 1. Copy hook files ----------------------------------------------------
run "mkdir -p \"$HOOKS_DEST\""

copy_one() {
    local src="$SCRIPT_DIR/$1"
    local dst="$HOOKS_DEST/$1"
    if [ ! -f "$src" ]; then
        echo "skip: $1 not found in repo" >&2
        return
    fi
    if [ -f "$dst" ] && [ "$FORCE" != "1" ]; then
        if cmp -s "$src" "$dst"; then
            echo "ok   $1 (already current)"
            return
        fi
        if [ "$dst" -nt "$src" ]; then
            echo "warn $1 destination newer than repo — pass --force to overwrite" >&2
            return
        fi
    fi
    run "cp \"$src\" \"$dst\" && chmod +x \"$dst\""
    echo "copy $1"
}

for spec in "${HOOK_SPECS[@]}"; do
    file="${spec%%|*}"
    copy_one "$file"
done
copy_one "$VAULT_GET"

# ---- 2. Merge settings.json ------------------------------------------------
# Use python for JSON manipulation — preserves unrelated keys, dedupes by command.

python3 - "$SETTINGS" "$DRY_RUN" "$HOOKS_DEST" "${HOOK_SPECS[@]}" <<'PY'
import json, os, sys, tempfile

settings_path = sys.argv[1]
dry_run = sys.argv[2] == "1"
hooks_dest = sys.argv[3]
specs_raw = sys.argv[4:]

# Each spec is "file|event|matcher_a|matcher_b|..."  — matcher parts joined with |
specs = []
for s in specs_raw:
    parts = s.split("|")
    fname = parts[0]
    event = parts[1]
    matcher = "|".join(p for p in parts[2:] if p)  # empty parts dropped → "" matcher
    specs.append((fname, event, matcher))

if os.path.exists(settings_path):
    with open(settings_path, "r", encoding="utf-8") as f:
        try:
            settings = json.load(f)
        except Exception as e:
            print(f"error: {settings_path} is not valid JSON ({e})", file=sys.stderr)
            sys.exit(1)
else:
    settings = {}

hooks_root = settings.setdefault("hooks", {})

added = []
existing = []

for fname, event, matcher in specs:
    cmd_path = os.path.join(hooks_dest, fname)
    bucket = hooks_root.setdefault(event, [])

    # Find matcher block
    matcher_block = None
    for b in bucket:
        if b.get("matcher", "") == matcher:
            matcher_block = b
            break
    if matcher_block is None:
        matcher_block = {"matcher": matcher, "hooks": []}
        bucket.append(matcher_block)

    block_hooks = matcher_block.setdefault("hooks", [])
    # Dedupe by command path
    if any(h.get("command") == cmd_path for h in block_hooks):
        existing.append(f"{event}/{matcher or '*'} → {fname}")
        continue
    block_hooks.append({"type": "command", "command": cmd_path})
    added.append(f"{event}/{matcher or '*'} → {fname}")

print()
print("==> settings.json hook registration:")
if added:
    print("    added:")
    for a in added:
        print(f"      + {a}")
else:
    print("    added: (none)")
if existing:
    print("    already present:")
    for e in existing:
        print(f"      = {e}")

if not added:
    print("    no changes needed.")
    sys.exit(0)

if dry_run:
    print("\n    [dry-run] would write merged settings.json")
    sys.exit(0)

# Atomic write
os.makedirs(os.path.dirname(settings_path), exist_ok=True)
fd, tmp = tempfile.mkstemp(prefix=".settings-", dir=os.path.dirname(settings_path))
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
        f.write("\n")
    os.replace(tmp, settings_path)
    print(f"\n    wrote {settings_path}")
except Exception:
    try:
        os.unlink(tmp)
    except Exception:
        pass
    raise
PY

echo
echo "==> done"
echo
echo "Next steps:"
echo "  1. Reload your Claude Code session (or restart the IDE) to pick up hooks."
echo "  2. Optional: set env vars for opt-in features:"
echo "       CLAUDE_PROJECTS_ROOT  → enables auto-adopt detection (auto-adopt.sh)"
echo "       CLAUDE_ADOPT_SCRIPT   → path to template/startup.sh for adopt action"
echo "       CLAUDE_AUTO_ADOPT=1   → auto-scaffold unadopted folders silently"
echo "       CRED_SCRUB_TOOL_BLOCK=1 → escalate cred-post-tool warnings to block"
echo "  3. Verify: jq '.hooks | keys' \"$SETTINGS\""
