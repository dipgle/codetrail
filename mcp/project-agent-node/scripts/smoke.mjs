#!/usr/bin/env node
// Smoke test: spawn dist/server.js, exercise core tools + cross-project inbox.
//
// Setup: a temp PROJECTS_ROOT with two project dirs (sender, receiver), each
// with logs/devlog.sqlite. Server runs as sender; it sends a message to
// receiver, then lists receiver's inbox via the project param, marks
// resolved, and fetches the thread.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const here = fileURLToPath(new URL(".", import.meta.url));
const serverPath = join(here, "..", "dist", "server.js");

const root = mkdtempSync(join(tmpdir(), "codetrail-smoke-"));
const aiDir = join(root, "AI");
const senderName = "sender-app";
const receiverName = "receiver-app";
const senderDir = join(aiDir, senderName);
const receiverDir = join(aiDir, receiverName);

// Pre-seed each project's logs dir + an empty devlog so resolveExternalDevlog
// finds them (server will create schema on first open).
for (const dir of [senderDir, receiverDir]) {
  mkdirSync(join(dir, "logs"), { recursive: true });
  mkdirSync(join(dir, "memory"), { recursive: true });
  // touch sqlite with empty schema so file exists
  const db = new Database(join(dir, "logs", "devlog.sqlite"));
  db.close();
}

const env = {
  ...process.env,
  PROJECTS_ROOT: root,
  PROJECT_LOG_DIR: join(senderDir, "logs"),
  PROJECT_MEMORY_DIR: join(senderDir, "memory"),
  CODETRAIL_PROJECT: senderName,
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

function parseText(resp) {
  const t = resp?.result?.content?.[0]?.text;
  return t ? JSON.parse(t) : null;
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
    "get_thread",
    "list_inbox",
    "list_projects",
    "list_test_cases",
    "list_use_cases",
    "log_event",
    "mark_resolved",
    "next_task",
    "recent_events",
    "record_test_run",
    "save_memory",
    "scan_health",
    "search_knowledge",
    "send_message",
  ];
  check(
    `tools/list returns 18 expected tools (got ${names.length})`,
    JSON.stringify(names) === JSON.stringify(expected),
    `got: ${JSON.stringify(names)}`
  );

  // --- Core: log_event + recent_events ---
  const logResp = await rpc("tools/call", {
    name: "log_event",
    arguments: { kind: "note", actor: "smoke", content: "smoke test hello" },
  });
  const logParsed = parseText(logResp);
  check(
    "log_event returns numeric id",
    typeof logParsed?.id === "number" && logParsed.id > 0,
    JSON.stringify(logParsed)
  );

  const recentResp = await rpc("tools/call", {
    name: "recent_events",
    arguments: { limit: 5 },
  });
  const recentParsed = parseText(recentResp);
  check(
    "recent_events returns the logged event",
    Array.isArray(recentParsed) &&
      recentParsed.some((e) => e.kind === "note" && e.actor === "smoke"),
    `got ${recentParsed?.length ?? 0} events`
  );

  // --- Inbox: cross-project round-trip ---
  // Send: sender-app → receiver-app
  const sendResp = await rpc("tools/call", {
    name: "send_message",
    arguments: {
      to: receiverName,
      kind: "feature_request",
      priority: "high",
      refType: "gap",
      refId: "GAP-X",
      content: "Please ship feature X by next week",
    },
  });
  const sent = parseText(sendResp);
  check(
    "send_message stores in receiver's inbox + returns id+sender",
    typeof sent?.id === "number" && sent.sender === senderName && sent.to === receiverName,
    JSON.stringify(sent)
  );

  // List: from receiver's inbox (cross-project read)
  const listResp = await rpc("tools/call", {
    name: "list_inbox",
    arguments: { project: receiverName, status: "unread" },
  });
  const inbox = parseText(listResp);
  const msg = Array.isArray(inbox) ? inbox.find((m) => m.ref_id === "GAP-X") : null;
  check(
    "list_inbox(receiver) returns the unread message",
    msg && msg.sender_project === senderName && msg.priority === "high",
    JSON.stringify(msg)
  );

  // Reply: receiver sends a reply with same refId
  const replyResp = await rpc("tools/call", {
    name: "send_message",
    arguments: {
      sender: receiverName,
      to: senderName,
      kind: "reply",
      refType: "gap",
      refId: "GAP-X",
      content: "Shipped in commit abc123",
    },
  });
  const reply = parseText(replyResp);
  check(
    "send_message reply with same refId stores in sender's inbox",
    typeof reply?.id === "number",
    JSON.stringify(reply)
  );

  // Mark resolved: original message in receiver's inbox
  const markResp = await rpc("tools/call", {
    name: "mark_resolved",
    arguments: {
      project: receiverName,
      inboxId: msg.id,
      resolution: "shipped abc123",
    },
  });
  const marked = parseText(markResp);
  check(
    "mark_resolved updates status",
    marked?.resolved === true,
    JSON.stringify(marked)
  );

  // Thread: both messages share refId GAP-X, but they live in DIFFERENT inboxes
  // (recipient owns). So get_thread from sender's inbox returns only the reply.
  const threadSenderResp = await rpc("tools/call", {
    name: "get_thread",
    arguments: { refId: "GAP-X" },
  });
  const threadSender = parseText(threadSenderResp);
  check(
    "get_thread(sender) returns the reply",
    Array.isArray(threadSender) &&
      threadSender.length === 1 &&
      threadSender[0].kind === "reply",
    `got ${threadSender?.length} entries`
  );

  const threadReceiverResp = await rpc("tools/call", {
    name: "get_thread",
    arguments: { project: receiverName, refId: "GAP-X" },
  });
  const threadReceiver = parseText(threadReceiverResp);
  check(
    "get_thread(receiver) returns the original request (now resolved)",
    Array.isArray(threadReceiver) &&
      threadReceiver.length === 1 &&
      threadReceiver[0].kind === "feature_request" &&
      threadReceiver[0].status === "resolved",
    `got ${threadReceiver?.length} entries; first status=${threadReceiver?.[0]?.status}`
  );

  // Verify list_inbox shows the resolved one only when status=resolved
  const resolvedResp = await rpc("tools/call", {
    name: "list_inbox",
    arguments: { project: receiverName, status: "resolved" },
  });
  const resolvedList = parseText(resolvedResp);
  check(
    "list_inbox(receiver, status=resolved) shows the marked message",
    Array.isArray(resolvedList) &&
      resolvedList.some((m) => m.ref_id === "GAP-X" && m.resolution === "shipped abc123"),
    JSON.stringify(resolvedList)
  );
} finally {
  proc.kill("SIGTERM");
  rmSync(root, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
} else {
  console.log(`\nAll smoke checks passed`);
  process.exit(0);
}
