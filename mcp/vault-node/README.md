# vault — secret-by-reference MCP server

MCP server for autonomous Claude Code sessions that need to run commands
using secrets (DB passwords, API keys, deploy tokens) **without the secret
ever entering the LLM's context**.

## Security model

```
   Claude (cloud)                vault (local)               keychain
   ──────────────                ─────────────               ────────
   sees: secret_ref ─────call──► resolve from keychain ◄────┘
         "db.prod.url"           pass via env $SECRET
                                      │
                                      ▼
                                 subprocess (pg_dump, curl, ...)
                                      │
                                      ▼
                                 exit_code + stderr_first_line
   ◄─────safe summary────────────────┘
```

Guarantees:
- Secret value is **never** in Claude's request/response context.
- Secret is **never** in subprocess argv (so `ps` cannot see it).
- subprocess stdout is **never** returned to Claude — only exit code +
  first line of stderr capped at 200 chars.
- First word of the command must be in the allowlist. The shipped baseline is
  `pg_dump`, `psql`, `curl`, `aws`, `gh`; see
  [Widening the allowlist](#widening-the-allowlist) to extend it per install.
- Fetched secret buffer is zeroed immediately after subprocess spawn.
  Note: the value briefly lives as a JS string (immutable, not truly
  zeroizable) while being passed to `spawnSync({ env })` — best-effort.

## Requirements

- macOS (uses the system `security` CLI to read from keychain).
- Node `>= 20`.

## Setup

### 1. Build

```bash
cd mcp/vault-node
npm install
npm run build
# Output: dist/server.js
```

### 2. Store secrets in macOS keychain

```bash
# Store (replace <value> with the actual secret — keep it OUT of files/history)
security add-generic-password -s "db.prod.connstr" -a vault -w '<value>'

# Verify presence (does NOT print value)
security find-generic-password -s "db.prod.connstr" >/dev/null && echo "ok"

# Update = delete + re-add
security delete-generic-password -s "db.prod.connstr"
```

The `-a vault` account name scopes entries to this tool.

### 3. Register the MCP server in a project's `.mcp.json`

```json
{
  "mcpServers": {
    "vault": {
      "type": "stdio",
      "command": "node",
      "args": ["<absolute-path-to>/mcp/vault-node/dist/server.js"]
    }
  }
}
```

First run on macOS may prompt for keychain access — choose **Always Allow**
so autonomous runs don't block.

## Widening the allowlist

Set `VAULT_EXTRA_COMMANDS` in the server's MCP registration — comma or
space separated. It is appended to the baseline, never replaces it:

```json
"vault": {
  "type": "stdio",
  "command": "node",
  "args": ["/path/to/mcp/vault-node/dist/server.js"],
  "env": { "VAULT_EXTRA_COMMANDS": "node,make" }
}
```

Read at startup only, from the registration the operator writes. No tool
widens the allowlist at runtime, so nothing the model does can reach it.
Restart the MCP client for a change to take effect.

Decide deliberately. What this server guarantees is about the secret VALUE —
resolved in-process, passed only through `$SECRET`, kept out of argv, and the
subprocess's stdout never returned. That holds whatever the allowlist says.
What the allowlist bounds is what a command can DO while holding the secret.
The baseline already contains `curl`, a general-purpose network client, so
adding an interpreter is a difference of degree rather than of kind — but add
what the job actually needs, and never add a shell.

One consequence worth planning around: stdout is discarded, so a widened
command that you need output from has to write it somewhere you can read
afterwards — `node deploy.mjs > /tmp/deploy.log 2>&1`, then open the file.

## Usage from Claude

```
vault.list_allowed_commands()
vault.exec_with_secret(
  secret_ref="db.prod.connstr",
  command_template="pg_dump $SECRET | gzip > /tmp/backup.gz"
)

# Returns:
{ "exit_code": 0, "status": "OK", "summary": "" }
```

The secret is fetched from keychain, injected as `$SECRET` env var into the
subprocess, then the buffer is wiped. Claude never sees the value.

## Allowlist

Currently: `pg_dump`, `psql`, `curl`, `aws`, `gh`. Edit
[`src/server.ts`](src/server.ts) → `ALLOWED_COMMANDS` then `npm run build`.
Every addition is a security decision — review what the command could do
with `$SECRET` in its env.

## Smoke test

```bash
npm run smoke
```

Exercises stdio handshake, `tools/list`, `list_allowed_commands`, the
`BLOCKED` path, and the `SECRET_NOT_FOUND` path. No real keychain entry
needed.

## Threat model (residual risks)

| Risk | Mitigated? | How |
|------|------------|-----|
| Secret in Claude history | yes | Never returned to Claude |
| Secret in `ps` output | yes | Env var, not argv |
| Secret in subprocess stdout reaching Claude | yes | stdout discarded |
| Secret leaking via stderr | partial | Capped 200 chars first line; review allowlisted commands' stderr behavior |
| Keychain file disk leak | partial | Encrypted at rest by macOS keychain; same risk as any keychain entry |
| Subprocess writing secret to disk | no | Up to the command. `pg_dump` to file is fine; arbitrary script could write `$SECRET` anywhere |
| Side-channel (timing, length) | no | Claude can infer length/format from `summary`; treat as low-info leak |
| Compromised vault binary | no | Trust this binary as you trust any auth tool |
| User running with `sudo` exposing env | partial | Don't. Vault should run as user |

## What this does NOT solve

- Reasoning ON sensitive content (e.g. "find PII in this DB dump"). The
  secret value is gone, but the *data fetched using it* may still be
  sensitive and would flow to Claude if read back.
- Arbitrary command execution. Allowlist is the only gate.
- Multi-machine deploys. Keychain is per-machine.

## Files

- [`package.json`](package.json) — deps: `@modelcontextprotocol/sdk`, `zod`
- [`src/server.ts`](src/server.ts) — server + 2 tools
- [`scripts/smoke.mjs`](scripts/smoke.mjs) — stdio smoke test
- `dist/server.js` — built output (gitignored)
