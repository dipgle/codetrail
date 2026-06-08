#!/usr/bin/env bash
# PostToolUse hook: scan tool results from Read / Bash / Grep / MCP for
# credential-shaped strings. Logs + warns; does NOT silently rewrite tool
# output (Claude Code PostToolUse cannot mutate already-emitted results).
#
# Why: backstop after cred-pre-tool.sh. Even if a Bash command was allowed
# (e.g. an `ls` that happened to print a token via filename, or an MCP
# response we couldn't predict), we want a loud warning + audit trail so
# the model and user both know a literal entered context.
#
# Behavior:
#   - Matches tool_name = Read | Bash | Grep | mcp__*.
#   - Reuses the cred-shape pattern set from cred-scrubber.sh (kept in sync
#     manually). Adds vendor prefixes: re_/eyJ/AIza/sk_live_/npm_.
#   - On hit:
#       * Append to ~/.claude/cred-block.log (meta only; no values).
#       * Emit hookSpecificOutput.additionalContext warning listing
#         categories + counts + a reminder NOT to echo the literal back.
#       * Save literal -> placeholder mapping into the per-session vault
#         file used by vault-get.sh (same format as cred-scrubber.sh) so
#         the user can recover via `vault-get.sh <session> cred-N`.
#   - Set env CRED_SCRUB_TOOL_BLOCK=1 to escalate hits to decision:block.

set -u
INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 - <<'PY'
import json, os, re, sys, datetime, fcntl, tempfile

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

tool = data.get("tool_name") or ""
session_id = data.get("session_id") or "unknown"

def to_text(obj):
    # Walk dict/list and concatenate string leaves with real newlines so the
    # value-capture regex stops at line breaks. json.dumps would escape
    # newlines to literal \\n which is neither whitespace nor quote, letting
    # a greedy value capture swallow subsequent labels.
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        return "\n".join(to_text(v) for v in obj.values())
    if isinstance(obj, (list, tuple)):
        return "\n".join(to_text(v) for v in obj)
    return str(obj)

result_text = to_text(data.get("tool_response"))
if not result_text or len(result_text) < 8:
    sys.exit(0)

TOKEN_PATTERNS = [
    (r"\bAKIA[0-9A-Z]{16}\b", "aws-access-key"),
    (r"\bASIA[0-9A-Z]{16}\b", "aws-temp-access-key"),
    (r"\bghp_[A-Za-z0-9]{30,}\b", "github-pat"),
    (r"\bgho_[A-Za-z0-9]{30,}\b", "github-oauth-token"),
    (r"\bghs_[A-Za-z0-9]{30,}\b", "github-server-token"),
    (r"\bgithub_pat_[A-Za-z0-9_]{50,}\b", "github-fine-grained-pat"),
    (r"\bsk-ant-[A-Za-z0-9_\-]{20,}\b", "anthropic-key"),
    (r"\bsk-[A-Za-z0-9]{20,}\b", "openai-style-key"),
    (r"\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b", "stripe-key"),
    (r"\bxox[bpoaer]-[A-Za-z0-9\-]{10,}\b", "slack-token"),
    (r"\bglpat-[A-Za-z0-9_\-]{20,}\b", "gitlab-pat"),
    (r"\bnpm_[A-Za-z0-9]{30,}\b", "npm-token"),
    (r"\bre_[A-Za-z0-9_-]{20,}\b", "resend-key"),
    (r"\bAIza[0-9A-Za-z_\-]{30,}\b", "google-api-key"),
    (r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b", "jwt"),
    (r"-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----", "private-key-block"),
]
URL_EMBED_RE = re.compile(
    r"(?i)\b[a-z][a-z0-9+\-.]*://[A-Za-z0-9._\-%]+:[^/\s@]{3,}@[^\s/]+"
)
LABELED_RE = re.compile(
    r"(?i)(?:^|[^A-Za-z0-9])"
    r"(password|passwd|"
    r"api[_-]?key|"
    r"secret(?:[_-]?(?:access[_-]?)?key)?|"
    r"access[_-]?(?:token|key|secret|key[_-]?id)|"
    r"bearer[_-]?token|auth[_-]?token|"
    r"client[_-]?secret|"
    r"private[_-]?key)"
    r"(?=[^A-Za-z0-9])"
    r"\s*[:=]+\s*[\"']?([^\s\"',;]{8,128})"
)
PLACEHOLDER_PREFIXES = ("$", "<", "{", "%")
PLACEHOLDER_WORDS = re.compile(
    r"^(your[-_]|xxx+$|placeholder|example|todo|fixme|secret[-_]?here|"
    r"none$|null$|n/a$|redacted|env\.[A-Z_]+$|process\.env\.)",
    re.IGNORECASE,
)

hits = []

for m in URL_EMBED_RE.finditer(result_text):
    hits.append({"start": m.start(), "end": m.end(), "value": m.group(0), "category": "url-embedded-credential"})

for m in LABELED_RE.finditer(result_text):
    val = m.group(2)
    raw = val.rstrip('".,;)]}')
    if len(raw) < 8:
        continue
    if raw[0] in PLACEHOLDER_PREFIXES:
        continue
    if PLACEHOLDER_WORDS.match(raw):
        continue
    vs = m.start(2)
    ve = vs + len(raw)
    hits.append({"start": vs, "end": ve, "value": raw, "category": "labeled-credential"})

for pat, cat in TOKEN_PATTERNS:
    for m in re.finditer(pat, result_text):
        hits.append({"start": m.start(), "end": m.end(), "value": m.group(0), "category": cat})

if not hits:
    sys.exit(0)

hits.sort(key=lambda h: (h["start"], -(h["end"] - h["start"])))
resolved = []
last_end = -1
for h in hits:
    if h["start"] >= last_end:
        resolved.append(h)
        last_end = h["end"]

if not resolved:
    sys.exit(0)

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
VAULT_DIR = os.path.expanduser("~/.claude/vault")
try:
    os.makedirs(VAULT_DIR, mode=0o700, exist_ok=True)
    os.chmod(VAULT_DIR, 0o700)
except Exception:
    pass

safe_session = re.sub(r"[^A-Za-z0-9_\-]", "_", session_id)[:64] or "unknown"
vault_path = os.path.join(VAULT_DIR, f"{safe_session}.json")
lock_path = vault_path + ".lock"

def load_vault():
    if not os.path.exists(vault_path):
        return {"session_id": session_id, "created": now_iso, "entries": {}}
    try:
        with open(vault_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"session_id": session_id, "created": now_iso, "entries": {}}

def save_vault(v):
    fd, tmp = tempfile.mkstemp(prefix=".vault-", dir=VAULT_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(v, f, indent=2)
        os.chmod(tmp, 0o600)
        os.replace(tmp, vault_path)
        os.chmod(vault_path, 0o600)
    except Exception:
        try:
            os.unlink(tmp)
        except Exception:
            pass
        raise

placeholders_for_warn = []
try:
    lf = open(lock_path, "a+")
    fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
    try:
        vault = load_vault()
        entries = vault.setdefault("entries", {})
        value_to_key = {e["value"]: k for k, e in entries.items()}
        def alloc_key():
            n = 1
            while f"cred-{n}" in entries:
                n += 1
            return f"cred-{n}"
        seen_in_this_hit = []
        for h in resolved:
            v = h["value"]
            if v in value_to_key:
                k = value_to_key[v]
            else:
                k = alloc_key()
                entries[k] = {
                    "value": v,
                    "category": h["category"],
                    "first_seen": now_iso,
                    "source": f"tool:{tool}",
                }
                value_to_key[v] = k
            seen_in_this_hit.append((k, h["category"]))
        placeholders_for_warn = seen_in_this_hit
        save_vault(vault)
    finally:
        fcntl.flock(lf.fileno(), fcntl.LOCK_UN)
        lf.close()
except Exception:
    pass

try:
    log_path = os.path.expanduser("~/.claude/cred-block.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": now_iso,
            "session_id": session_id,
            "source": f"tool:{tool}",
            "hit_count": len(resolved),
            "categories": sorted({h["category"] for h in resolved}),
            "placeholders": [k for k, _ in placeholders_for_warn],
            "result_len": len(result_text),
        }) + "\n")
except Exception:
    pass

cats = sorted({h["category"] for h in resolved})
placeholders_summary = ", ".join(f"<{k}>" for k, _ in placeholders_for_warn) or "(unallocated)"

warning = (
    f"[cred-leak-detected] Tool result from `{tool}` contained "
    f"{len(resolved)} credential-shaped literal(s) (categories: "
    f"{', '.join(cats)}). They are ALREADY in your context — PostToolUse "
    f"cannot un-emit the tool output. Rules going forward:\n"
    f"  1. Do NOT echo the literal back to the user in any reply.\n"
    f"  2. Refer to them by placeholder ({placeholders_summary}) if needed.\n"
    f"  3. If a future Bash command needs the value, use "
    f"`~/.claude/hooks/vault-get.sh {safe_session} cred-N` to interpolate "
    f"at exec time instead of pasting the literal.\n"
    f"  4. Suggest the user move the secret out of this file (env var, "
    f"secret manager) so it stops surfacing in tool reads."
)

hard_block = os.environ.get("CRED_SCRUB_TOOL_BLOCK") == "1"

out = {
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": warning,
    },
}
if hard_block:
    out["decision"] = "block"
    out["reason"] = warning

print(json.dumps(out))
sys.exit(0)
PY
