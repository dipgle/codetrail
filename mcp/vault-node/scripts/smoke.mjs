#!/usr/bin/env node
// Smoke test for vault-node MCP server.
// Verifies stdio handshake + tools/list + the BLOCKED path of exec_with_secret
// (using a command guaranteed to be off-allowlist, so no keychain is touched).

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "server.js");

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      console.error("[smoke] non-JSON from server:", line);
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

function request(method, params) {
  const id = nextId++;
  const payload = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify(payload) + "\n");
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function assert(cond, label) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}`);
    process.exitCode = 1;
  }
}

try {
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  assert(init.result?.serverInfo?.name === "vault", "initialize → serverInfo.name=vault");
  notify("notifications/initialized", {});

  const list = await request("tools/list", {});
  const tools = list.result?.tools ?? [];
  const names = tools.map((t) => t.name).sort();
  assert(
    names.includes("exec_with_secret") && names.includes("list_allowed_commands"),
    `tools/list → both tools present (got ${names.join(",")})`,
  );

  const allowed = await request("tools/call", {
    name: "list_allowed_commands",
    arguments: {},
  });
  const allowedText = allowed.result?.content?.[0]?.text ?? "";
  const allowedArr = JSON.parse(allowedText);
  assert(
    Array.isArray(allowedArr) && allowedArr.includes("pg_dump"),
    `list_allowed_commands → includes pg_dump (got ${allowedText})`,
  );

  const blocked = await request("tools/call", {
    name: "exec_with_secret",
    arguments: {
      secret_ref: "nonexistent.ref",
      command_template: "rm -rf /",
    },
  });
  const blockedRes = JSON.parse(blocked.result?.content?.[0]?.text ?? "{}");
  assert(
    blockedRes.status === "BLOCKED" && blockedRes.exit_code === -1,
    `BLOCKED path → status=BLOCKED, got ${JSON.stringify(blockedRes)}`,
  );

  const allowedCmdMissingSecret = await request("tools/call", {
    name: "exec_with_secret",
    arguments: {
      secret_ref: "definitely.does.not.exist.in.keychain.smoke-test",
      command_template: "curl --version",
    },
  });
  const missingRes = JSON.parse(
    allowedCmdMissingSecret.result?.content?.[0]?.text ?? "{}",
  );
  assert(
    missingRes.status === "SECRET_NOT_FOUND",
    `SECRET_NOT_FOUND path → got ${JSON.stringify(missingRes)}`,
  );
} catch (e) {
  console.error("[smoke] exception:", e);
  process.exitCode = 1;
} finally {
  child.kill();
}
