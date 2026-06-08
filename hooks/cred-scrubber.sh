#!/usr/bin/env bash
# UserPromptSubmit hook: redact credential-shaped strings to stable placeholders
# (<cred-N>) before the model sees them. Mapping is stored in a session-scoped
# vault file so values can be looked up at tool-execution time without ever
# entering the model context.
#
# Why: chat layer does NOT redact creds; vault MCP is secret-by-reference, not
# a content scrubber. User wants paste-then-redact-with-recovery — placeholder
# in transcript, real value stays on disk (chmod 600), lookup via vault-get
# only when a Bash command actually needs to execute the value.
#
# Behavior:
#   1. Scan prompt for known cred shapes (URL, labeled, slash-form, tokens, PEM)
#   2. For each unique literal, allocate stable <cred-N> placeholder
#      (re-uses existing N if same literal seen before in this session)
#   3. Write mapping to ~/.claude/vault/<session_id>.json (chmod 600)
#   4. Emit additionalContext warning to the model
#
# Fallback: if vault write fails (disk, perms), block-with-error instead of
# leaking. Better safe than sorry.

set -u

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 - <<'PY'
import json, re, sys, os, datetime, fcntl, tempfile

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except Exception:
    sys.exit(0)

prompt = data.get("prompt") or ""
session_id = data.get("session_id") or "unknown"
if not prompt or len(prompt) < 8:
    sys.exit(0)

PATTERNS = []

# 1. URL with embedded creds
PATTERNS.append((
    re.compile(r"(?i)\b[a-z][a-z0-9+\-.]*://[A-Za-z0-9._\-%]+:[^/\s@]{3,}@[^\s/]+"),
    "url-embedded-credential",
    0,
))

# 2. Labeled creds
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
    r"\s*[:=]+\s*[\"']?([^\s\"',;]{6,128})"
)
PLACEHOLDER_PREFIXES = ("$", "<", "{", "%")
PLACEHOLDER_WORDS = re.compile(
    r"^(your[-_]|xxx+$|placeholder|example|todo|fixme|secret[-_]?here|none$|null$|n/a$|redacted|env\.[A-Z_]+$|process\.env\.)",
    re.IGNORECASE,
)

# 3. user/password shorthand
SLASH_RE = re.compile(
    r"(?<![/\w])([A-Za-z][\w._-]{2,32})/([A-Za-z0-9._\-]*[!@#$%^&*+=][A-Za-z0-9!@#$%^&*_+=.\-]{4,64})(?=[\s\"'`,;]|$)"
)

# 4. Known token shapes
TOKEN_PATTERNS = [
    (r"\bAKIA[0-9A-Z]{16}\b", "aws-access-key"),
    (r"\bASIA[0-9A-Z]{16}\b", "aws-temp-access-key"),
    (r"\bghp_[A-Za-z0-9]{30,}\b", "github-pat"),
    (r"\bgho_[A-Za-z0-9]{30,}\b", "github-oauth-token"),
    (r"\bghs_[A-Za-z0-9]{30,}\b", "github-server-token"),
    (r"\bgithub_pat_[A-Za-z0-9_]{50,}\b", "github-fine-grained-pat"),
    (r"\bsk-ant-[A-Za-z0-9_\-]{20,}\b", "anthropic-key"),
    (r"\bsk-[A-Za-z0-9]{20,}\b", "openai-style-key"),
    (r"\bxox[bpoaer]-[A-Za-z0-9\-]{10,}\b", "slack-token"),
    (r"\bglpat-[A-Za-z0-9_\-]{20,}\b", "gitlab-pat"),
    (r"-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----", "private-key-block"),
]

hits = []

for regex, cat, gi in PATTERNS:
    for m in regex.finditer(prompt):
        if gi == 0:
            start, end, val = m.start(), m.end(), m.group(0)
        else:
            start, end, val = m.start(gi), m.end(gi), m.group(gi)
        hits.append({"start": start, "end": end, "value": val, "category": cat})

for m in LABELED_RE.finditer(prompt):
    val = m.group(2)
    raw = val.rstrip('".,;)]}')
    if not raw or len(raw) < 6:
        continue
    if raw[0] in PLACEHOLDER_PREFIXES:
        continue
    if PLACEHOLDER_WORDS.match(raw):
        continue
    if raw.isalpha() and raw.islower() and len(raw) < 10:
        continue
    vs = m.start(2)
    ve = vs + len(raw)
    hits.append({"start": vs, "end": ve, "value": raw, "category": "labeled-credential"})

for m in SLASH_RE.finditer(prompt):
    hits.append({
        "start": m.start(),
        "end": m.end(),
        "value": m.group(0),
        "category": "user/password-shorthand",
    })

for pat, cat in TOKEN_PATTERNS:
    for m in re.finditer(pat, prompt):
        hits.append({
            "start": m.start(),
            "end": m.end(),
            "value": m.group(0),
            "category": cat,
        })

if not hits:
    sys.exit(0)

# Resolve overlaps: prefer longest at any byte position
hits.sort(key=lambda h: (h["start"], -(h["end"] - h["start"])))
resolved = []
last_end = -1
for h in hits:
    if h["start"] >= last_end:
        resolved.append(h)
        last_end = h["end"]

if not resolved:
    sys.exit(0)

VAULT_DIR = os.path.expanduser("~/.claude/vault")
os.makedirs(VAULT_DIR, mode=0o700, exist_ok=True)
try:
    os.chmod(VAULT_DIR, 0o700)
except Exception:
    pass

safe_session = re.sub(r"[^A-Za-z0-9_\-]", "_", session_id)[:64] or "unknown"
vault_path = os.path.join(VAULT_DIR, f"{safe_session}.json")

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

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

lock_path = vault_path + ".lock"
try:
    lf = open(lock_path, "a+")
    fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
except Exception:
    print(json.dumps({
        "decision": "block",
        "reason": "cred-scrubber: vault lock acquisition failed — credential not redacted, prompt blocked for safety. Re-send after fix.",
        "suppressOriginalPrompt": True,
    }))
    sys.exit(0)

try:
    vault = load_vault()
    entries = vault.setdefault("entries", {})

    value_to_key = {e["value"]: k for k, e in entries.items()}

    def alloc_key():
        n = 1
        while f"cred-{n}" in entries:
            n += 1
        return f"cred-{n}"

    redacted = prompt
    replaced = []
    for h in sorted(resolved, key=lambda x: -x["start"]):
        val = h["value"]
        if val in value_to_key:
            key = value_to_key[val]
        else:
            key = alloc_key()
            entries[key] = {
                "value": val,
                "category": h["category"],
                "first_seen": now_iso,
            }
            value_to_key[val] = key
        placeholder = f"<{key}>"
        redacted = redacted[: h["start"]] + placeholder + redacted[h["end"]:]
        replaced.append((placeholder, val, h["category"]))

    save_vault(vault)
finally:
    try:
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
            "cwd": data.get("cwd", ""),
            "redacted_count": len(replaced),
            "categories": sorted({c for _, _, c in replaced}),
            "placeholders": [p for p, _, _ in replaced],
            "prompt_len": len(prompt),
        }) + "\n")
except Exception:
    pass

placeholders_summary = ", ".join(sorted({p for p, _, _ in replaced}))
categories_summary = ", ".join(sorted({c for _, _, c in replaced}))

additional_context = (
    f"[cred-scrubber] User's prompt contains {len(replaced)} credential literal(s) "
    f"(categories: {categories_summary}). Hook API cannot rewrite the prompt, so "
    f"the literal IS in your context this turn. Vault mapping recorded.\n\n"
    f"Placeholders: {placeholders_summary} (same literal always reuses same placeholder).\n"
    f"Vault file: {vault_path} (chmod 600).\n\n"
    f"RULES:\n"
    f"  1. In any reply, refer to credentials by placeholder. NEVER echo the literal back.\n"
    f"  2. For shell exec needing the literal, chain "
    f"`~/.claude/hooks/vault-get.sh {safe_session} <key>` in Bash.\n"
    f"  3. Do NOT print vault contents; user reads it themselves.\n"
    f"  4. If same secret keeps appearing, suggest env file / secret manager."
)

out = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": additional_context,
    },
}
print(json.dumps(out))
sys.exit(0)
PY
