#!/usr/bin/env bash
# PreToolUse hook: deny Read / Bash invocations that target known
# credential-file paths (.env, ~/.aws/credentials, id_rsa, *.pem, ...).
#
# Why: cred-scrubber.sh only fires on UserPromptSubmit. Tool-side reads of
# secret files bypass it — the file content lands in model context as a
# tool result. This hook is the first line of defense: stop the read before
# it happens. Use vault-get.sh (existing hook) for legitimate access.
#
# Behavior:
#   - Matches tool_name = Read | Bash.
#   - For Read: deny if file_path matches a secret-file pattern.
#   - For Bash: deny if the command contains a read-verb (cat/head/tail/
#     less/more/bat/nl/od/xxd/hexdump/grep/awk/sed/cut/tr/source/.) OR an
#     input redirect (< file, $(< file), $(cat file)) targeting a secret
#     path. Pure write/move/delete/list (rm/mv/cp/chmod/ls/stat) on the
#     same path is allowed.
#   - On deny: emit permissionDecision=deny + reason that tells the model
#     to use vault-get.sh for legitimate access.
#   - On any internal error: pass through (do NOT block — avoids breaking
#     the tool chain on hook bugs). cred-post-tool.sh is the backstop.

set -u
INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 - <<'PY'
import json, os, re, sys

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

tool = data.get("tool_name") or ""
ti = data.get("tool_input") or {}

SECRET_PATH_PATTERNS = [
    r"(?:^|/|\s)\.env(?:\.[A-Za-z0-9_.-]+)?(?:$|\s|:|\"|')",
    r"\bcredentials?(?:\.[a-z0-9]+)?\b",
    r"\bid_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?\b",
    r"\b[A-Za-z0-9_-]+_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?\b",
    r"\.(?:pem|key|p12|pfx|kdbx|keystore|jks)(?:$|[\s\"':])",
    r"\.(?:gpg|asc)(?:$|[\s\"':])",
    r"\.aws/credentials\b",
    r"\.aws/config\b",
    r"\.ssh/(?!known_hosts|config\b)[A-Za-z0-9._-]+",
    r"\bsecrets?\.[a-z0-9]+\b",
    r"\.netrc\b",
    r"\.docker/config\.json\b",
    r"\.npmrc\b",
    r"\.pypirc\b",
    r"\bservice[-_]account[A-Za-z0-9_.-]*\.json\b",
    r"\.kube/config\b",
    r"\bkubeconfig\b",
    r"\bvault[A-Za-z0-9_.-]*\.(?:json|ya?ml)\b",
    r"~/.claude/vault/",
    r"/\.claude/vault/",
]

ALLOW_PATTERNS = [
    r"\.env\.example\b",
    r"\.env\.sample\b",
    r"\.env\.template\b",
    r"\.env\.dist\b",
    r"id_rsa\.pub\b",
    r"\.pem\.example\b",
]

def is_secret_path(text):
    if not text:
        return False
    cleaned = text
    for ap in ALLOW_PATTERNS:
        cleaned = re.sub(ap, " ", cleaned)
    for pat in SECRET_PATH_PATTERNS:
        if re.search(pat, cleaned):
            return True
    return False

READ_VERB_RE = re.compile(
    r"(?:^|[\s|;&(`])(?:cat|tac|head|tail|less|more|bat|nl|od|xxd|hexdump|"
    r"strings|file|grep|egrep|fgrep|rg|ag|awk|gawk|sed|cut|tr|paste|"
    r"source|\.|printf|jq|yq|python3?|node|ruby|perl|env|printenv|"
    r"dotenv|export)\b"
)
INPUT_REDIR_RE = re.compile(r"<\s*[~/.\"']|\$\(\s*<\s*[~/.\"']|\$\(\s*cat\s")

def bash_is_read_op(cmd):
    if READ_VERB_RE.search(cmd):
        return True
    if INPUT_REDIR_RE.search(cmd):
        return True
    return False

def deny(reason):
    out = {
        "decision": "block",
        "reason": reason,
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        },
    }
    print(json.dumps(out))
    sys.exit(0)

if tool == "Read":
    fp = ti.get("file_path") or ""
    if is_secret_path(fp):
        deny(
            f"[cred-pre-tool] Read denied: '{fp}' matches a known credential-file "
            f"pattern. To use the value inside a Bash command, run "
            f"`~/.claude/hooks/vault-get.sh <session> <key>`. If this is a false "
            f"positive (e.g. .env.example), rename or paste a redacted excerpt."
        )

elif tool == "Bash":
    cmd = ti.get("command") or ""
    if is_secret_path(cmd) and bash_is_read_op(cmd):
        snippets = []
        for pat in SECRET_PATH_PATTERNS:
            m = re.search(pat, cmd)
            if m:
                snippets.append(m.group(0).strip())
        sample = ", ".join(sorted(set(snippets))[:3]) or "(secret path)"
        deny(
            f"[cred-pre-tool] Bash denied: command appears to READ credential-file "
            f"path(s): {sample}. Use `~/.claude/hooks/vault-get.sh <session> "
            f"<key>` to interpolate a real value at exec time, or paste a "
            f"redacted excerpt manually. If this is a legitimate non-read "
            f"operation (rm/mv/ls/chmod), rephrase the command to make that "
            f"explicit (e.g. avoid `cat` / `< file` / `source`)."
        )

sys.exit(0)
PY
