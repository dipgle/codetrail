#!/usr/bin/env node
// Smoke test: spawn dist/server.js, send initialize + tools/list + a log_event,
// verify responses, exit 0 on success.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const serverPath = join(here, "..", "dist", "server.js");

const workDir = mkdtempSync(join(tmpdir(), "codetrail-smoke-"));
const projectDir = join(workDir, "myproj");

const env = {
  ...process.env,
  PROJECT_LOG_DIR: join(projectDir, "logs"),
  PROJECT_MEMORY_DIR: join(projectDir, "memory"),
};

const proc = spawn(process.execPath, [serverPath], {
  env,
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
const pending = new Map();
let nextId = 1;

proc.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  for (;;) {
    const nl = buf.indexOf("\n");
    if (nl < 0) break;
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch (e) {
      console.error("non-JSON line from server:", line);
    }
  }
});

proc.stderr.on("data", (c) => process.stderr.write(`[srv] ${c}`));
proc.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`server exited code=${code}`);
    process.exit(1);
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 5000);
  });
}

function notify(method, params) {
  proc.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n"
  );
}

let failed = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
  }
}

try {
  const initResp = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  check(
    "initialize returns server info",
    initResp?.result?.serverInfo?.name === "project-agent",
    JSON.stringify(initResp?.result?.serverInfo)
  );
  notify("notifications/initialized", {});

  const tools = await rpc("tools/list", {});
  const names = (tools?.result?.tools ?? []).map((t) => t.name).sort();
  const expected = [
    "add_knowledge",
    "create_test_case",
    "create_use_case",
    "get_context_brief",
    "list_projects",
    "list_test_cases",
    "list_use_cases",
    "log_event",
    "next_task",
    "recent_events",
    "record_test_run",
    "save_memory",
    "scan_health",
    "search_knowledge",
  ];
  check(
    `tools/list returns 14 expected tools (got ${names.length})`,
    JSON.stringify(names) === JSON.stringify(expected),
    `got: ${JSON.stringify(names)}`
  );

  const logResp = await rpc("tools/call", {
    name: "log_event",
    arguments: {
      kind: "note",
      actor: "smoke",
      content: "smoke test hello",
    },
  });
  const logText = logResp?.result?.content?.[0]?.text;
  const logParsed = logText ? JSON.parse(logText) : null;
  check(
    "log_event returns numeric id",
    typeof logParsed?.id === "number" && logParsed.id > 0,
    JSON.stringify(logParsed)
  );

  const recentResp = await rpc("tools/call", {
    name: "recent_events",
    arguments: { limit: 5 },
  });
  const recentText = recentResp?.result?.content?.[0]?.text;
  const recentParsed = recentText ? JSON.parse(recentText) : null;
  check(
    "recent_events returns the logged event",
    Array.isArray(recentParsed) &&
      recentParsed.some((e) => e.kind === "note" && e.actor === "smoke"),
    `got ${recentParsed?.length ?? 0} events`
  );
} finally {
  proc.kill("SIGTERM");
  rmSync(workDir, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
} else {
  console.log(`\nAll smoke checks passed`);
  process.exit(0);
}
