#!/usr/bin/env bash
# vault-get: resolve a redacted placeholder back to its real value.
# Usage:   vault-get.sh <session-id> <key>
# Example: pass="$(~/.claude/hooks/vault-get.sh abc123 cred-1)"
#
# Reads from ~/.claude/vault/<session>.json (chmod 600). Prints the literal
# value on stdout if found, exit 0. On miss or error, prints to stderr,
# exit 1 (so shell `set -e` aborts cleanly).
#
# DO NOT call this and echo the output back to the chat — defeats redaction.
# Only chain into a real command:  ssh "$(vault-get session cred-1)"@host

set -u

if [ $# -ne 2 ]; then
    echo "usage: $0 <session-id> <key>" >&2
    exit 1
fi

SESSION="$1"
KEY="$2"
SAFE=$(printf '%s' "$SESSION" | tr -c 'A-Za-z0-9_-' '_' | cut -c1-64)
VAULT="$HOME/.claude/vault/${SAFE}.json"

if [ ! -f "$VAULT" ]; then
    echo "vault-get: no vault at $VAULT" >&2
    exit 1
fi

VALUE=$(python3 - "$VAULT" "$KEY" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
try:
    with open(path, "r", encoding="utf-8") as f:
        v = json.load(f)
except Exception as e:
    print(f"vault-get: read failed: {e}", file=sys.stderr)
    sys.exit(1)
entry = v.get("entries", {}).get(key)
if entry is None:
    print(f"vault-get: key '{key}' not in vault", file=sys.stderr)
    sys.exit(1)
sys.stdout.write(entry.get("value", ""))
PY
)
RC=$?
if [ $RC -ne 0 ]; then
    exit 1
fi
printf '%s' "$VALUE"
