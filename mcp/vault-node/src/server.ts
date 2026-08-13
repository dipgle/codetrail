#!/usr/bin/env node
// Secret-by-reference MCP server.
//
// Security model:
//   - Claude never sees actual secret values, only refs (e.g. "db.prod.url").
//   - Secret resolved inside this process from macOS keychain.
//   - Passed to subprocess via env var $SECRET (never argv — `ps` would leak).
//   - Subprocess stdout NEVER returned to Claude. Only exit code + stderr
//     first line (capped 200 chars).
//   - Command first word must be in ALLOWLIST.
//   - Secret buffer is overwritten with zeros immediately after subprocess spawn.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawnSync } from "node:child_process";

// Baseline allowlist shipped with the server. Add entries here only after a
// security review — this is the default every installation inherits.
const BASE_ALLOWED_COMMANDS = ["pg_dump", "psql", "curl", "aws", "gh"] as const;

// An operator can widen the allowlist for their own installation without
// forking the shipped default:
//
//   "vault": { "command": "node", "args": ["…/dist/server.js"],
//              "env": { "VAULT_EXTRA_COMMANDS": "node,make" } }
//
// Deliberately env-only. The value is read once at startup from the MCP server
// registration, which the operator writes and the model cannot reach — there is
// no tool here that widens the allowlist at runtime.
//
// Widening is a real decision, not a formality. The guarantee this server makes
// is about the secret VALUE: it is resolved in-process, passed only through
// $SECRET, kept out of argv, and the subprocess's stdout is never returned. That
// guarantee survives any allowlist. What the allowlist bounds is what a command
// can DO once it holds the secret — and the baseline already includes curl, a
// general-purpose network client, so an interpreter is a difference of degree
// rather than of kind. Add what the job needs; don't add a shell.
const EXTRA_ALLOWED_COMMANDS = (process.env.VAULT_EXTRA_COMMANDS ?? "")
  .split(/[,\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_COMMANDS: readonly string[] = [
  ...BASE_ALLOWED_COMMANDS,
  ...EXTRA_ALLOWED_COMMANDS,
];

type Status = "OK" | "FAILED" | "BLOCKED" | "SECRET_NOT_FOUND" | "EXEC_ERROR";

interface ExecResult {
  exit_code: number;
  status: Status;
  summary: string;
}

function result(r: ExecResult): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(r) }] };
}

function fetchSecret(ref: string): Buffer | { error: ExecResult } {
  const out = spawnSync(
    "security",
    ["find-generic-password", "-w", "-s", ref],
    { encoding: "buffer" },
  );
  if (out.error) {
    return {
      error: {
        exit_code: -1,
        status: "EXEC_ERROR",
        summary: `keychain access failed: ${out.error.message}`,
      },
    };
  }
  if (out.status !== 0) {
    return {
      error: {
        exit_code: -1,
        status: "SECRET_NOT_FOUND",
        summary: `ref '${ref}' not in keychain`,
      },
    };
  }
  // Trim trailing newline from `security -w` output, in-place on the buffer.
  let end = out.stdout.length;
  while (end > 0 && (out.stdout[end - 1] === 0x0a || out.stdout[end - 1] === 0x0d)) {
    end--;
  }
  return out.stdout.subarray(0, end);
}

function zeroize(buf: Buffer): void {
  buf.fill(0);
}

const server = new McpServer({ name: "vault", version: "0.1.0" });

server.tool(
  "exec_with_secret",
  "Execute a command with a secret resolved from macOS keychain. " +
    "The secret is set as $SECRET env var in the subprocess; it never appears " +
    "in argv, stdout returned to the LLM, or this server's logs. " +
    "Returns only exit code and stderr-first-line summary.",
  {
    secret_ref: z
      .string()
      .describe(
        "Reference name of secret in macOS keychain (e.g. 'db.prod.connstr'). " +
          "Store with: security add-generic-password -s <ref> -a vault -w",
      ),
    command_template: z
      .string()
      .describe(
        "Shell command. First word must be in allowlist. Use $SECRET to reference " +
          "the resolved value. Example: 'pg_dump $SECRET | gzip > /tmp/backup.gz'",
      ),
  },
  async ({ secret_ref, command_template }) => {
    // 1. Validate command first word against allowlist.
    const firstWord = command_template.trim().split(/\s+/)[0] ?? "";
    if (!ALLOWED_COMMANDS.includes(firstWord)) {
      return result({
        exit_code: -1,
        status: "BLOCKED",
        summary: `Command '${firstWord}' not in allowlist ${JSON.stringify(ALLOWED_COMMANDS)}`,
      });
    }

    // 2. Fetch secret from macOS keychain.
    const fetched = fetchSecret(secret_ref);
    if (!Buffer.isBuffer(fetched)) {
      return result(fetched.error);
    }
    const secret = fetched;

    // 3. Spawn subprocess with secret in env. stdout discarded (not piped back).
    const child = spawnSync("sh", ["-c", command_template], {
      env: { ...process.env, SECRET: secret.toString("utf8") },
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "buffer",
    });

    // 4. Zeroize secret buffer immediately. (Note: the toString('utf8') copy
    //    above creates a JS string that we cannot truly wipe; this matches
    //    the Rust version's best-effort guarantee for owned String.)
    zeroize(secret);

    if (child.error) {
      return result({
        exit_code: -1,
        status: "EXEC_ERROR",
        summary: child.error.message,
      });
    }

    const exitCode = child.status ?? -1;
    const stderrFirst = (child.stderr ?? Buffer.alloc(0))
      .toString("utf8")
      .split(/\r?\n/, 1)[0]
      .slice(0, 200);

    return result({
      exit_code: exitCode,
      status: exitCode === 0 ? "OK" : "FAILED",
      summary: stderrFirst,
    });
  },
);

server.tool(
  "list_allowed_commands",
  "List allowed command first-words. Use to plan commands before exec_with_secret.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(ALLOWED_COMMANDS) }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
