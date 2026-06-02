#!/usr/bin/env node
// Deploy codetrail/public/* to a tfl5 instance via the SDK wire protocol.
// Self-contained: native Node fetch + manual cookie jar. No SDK import.
//
// Inputs (env):
//   TFL5_HOST     — base URL, e.g. https://cpanel.tafalo.com
//   TFL5_USER     — username
//   TFL5_PASS     — password
//   APP_NAME      — display name for the app (default: "Codetrail")
//   APP_DOMAIN    — domain to bind (e.g. codetrail.dipgle.com)
//   APP_DIR       — directory whose contents are uploaded (default: public/)
//   STAGE         — "test" or "release" (default: release)
//   DRY_RUN       — if "1", login + plan + skip create/upload/bind

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const HOST = process.env.TFL5_HOST?.replace(/\/+$/, "");
const USER = process.env.TFL5_USER;
const PASS = process.env.TFL5_PASS;
const APP_NAME = process.env.APP_NAME || "Codetrail";
const APP_DOMAIN = process.env.APP_DOMAIN || "";
const APP_DIR = resolve(process.env.APP_DIR || "public");
const STAGE = process.env.STAGE || "release";
const DRY_RUN = process.env.DRY_RUN === "1";

if (!HOST || !USER || !PASS) {
  console.error("Missing TFL5_HOST / TFL5_USER / TFL5_PASS");
  process.exit(2);
}

// ------- cookie jar -------
const cookies = new Map();
function applySetCookie(res) {
  // node fetch exposes set-cookie as a single header — getSetCookie() returns array
  const list = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  for (const raw of list) {
    const [head] = raw.split(";");
    const i = head.indexOf("=");
    if (i < 0) continue;
    const k = head.slice(0, i).trim();
    const v = head.slice(i + 1).trim();
    if (k && v) cookies.set(k, v);
  }
}
function cookieHeader() {
  return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ------- HTTP helpers -------
async function postJson(path, body) {
  const url = `${HOST}${path}`;
  const headers = { "Content-Type": "application/json" };
  const ck = cookieHeader();
  if (ck) headers.Cookie = ck;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  applySetCookie(res);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) {
    const e = new Error(`POST ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    e.body = json;
    throw e;
  }
  // tfl5 envelope: {result, data, msg, timestamp} OR {data: ...}
  if (json && typeof json === "object" && "data" in json) return json.data;
  return json;
}

async function postForm(path, form) {
  const url = `${HOST}${path}`;
  const headers = {};
  const ck = cookieHeader();
  if (ck) headers.Cookie = ck;
  const res = await fetch(url, { method: "POST", headers, body: form });
  applySetCookie(res);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) {
    const e = new Error(`POST ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    e.body = json;
    throw e;
  }
  if (json && typeof json === "object" && "code" in json && "msg" in json && !("data" in json)) {
    const e = new Error(`POST ${path} → tfl5 ${json.code}: ${json.msg}`);
    e.body = json;
    throw e;
  }
  if (json && typeof json === "object" && "data" in json) return json.data;
  return json;
}

// ------- file walk -------
function walk(root) {
  const out = [];
  function rec(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) rec(p);
      else if (st.isFile()) out.push(p);
    }
  }
  rec(root);
  return out;
}

function mimeFor(p) {
  const ext = extname(p).toLowerCase();
  return ({
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".json": "application/json",
    ".sqlite": "application/x-sqlite3",
    ".db": "application/x-sqlite3",
  }[ext] || "application/octet-stream");
}

// ------- main -------
async function main() {
  console.log(`▶ tfl5 host : ${HOST}`);
  console.log(`▶ user      : ${USER}`);
  console.log(`▶ app       : ${APP_NAME}`);
  console.log(`▶ domain    : ${APP_DOMAIN || "(skip)"}`);
  console.log(`▶ dir       : ${APP_DIR}`);
  console.log(`▶ stage     : ${STAGE}`);
  console.log(`▶ dry-run   : ${DRY_RUN}`);
  console.log("");

  // 1. login
  console.log("→ login…");
  await postJson("/login", { username: USER, password: PASS });
  if (![...cookies.keys()].some((k) => k === "_token")) {
    console.warn("  (no _token cookie set — server may use different cookie name)");
  } else {
    console.log("  ok, cookie set");
  }

  // 2. find or create app
  console.log("→ resolve app…");
  const list = await postJson("/app/list", {});
  let app = Array.isArray(list) ? list.find((a) => a.name === APP_NAME) : null;
  if (app) {
    console.log(`  found existing: ${app.tid}`);
  } else if (DRY_RUN) {
    console.log("  would create new app (dry-run)");
    return;
  } else {
    console.log("  creating…");
    app = await postJson("/app/update", {
      data: { name: APP_NAME, description: "Persistent memory for AI coding sessions" },
    });
    console.log(`  created: ${app.tid}`);
  }

  const APP_TID = app.tid;

  // 3. upload files
  const files = walk(APP_DIR);
  const failures = [];
  console.log(`→ uploading ${files.length} files to stage=${STAGE}…`);
  if (DRY_RUN) {
    for (const f of files) console.log(`  (dry) ${relative(APP_DIR, f)}`);
  } else {
    for (const f of files) {
      const rel = "/" + relative(APP_DIR, f).split(/[\\/]/).join("/");
      const buf = readFileSync(f);
      const form = new FormData();
      form.append("app_tid", APP_TID);
      form.append("stage", STAGE);
      form.append("path", rel);
      form.append("file", new Blob([buf], { type: mimeFor(f) }), rel.split("/").pop());
      try {
        const r = await postForm("/app/file/upload", form);
        const id = Array.isArray(r) ? r[0]?.tid : r?.tid;
        console.log(`  ✓ ${rel}  (${buf.length} B, ${id ?? "?"})`);
      } catch (e) {
        console.error(`  ✗ ${rel}  ${e.message}`);
        // Continue-on-error: a single rejected file shouldn't abort the
        // whole deploy. We log + count failures and report at end.
        failures.push({ path: rel, err: e.message });
      }
    }
  }

  // 4. bind domain
  if (APP_DOMAIN) {
    console.log(`→ bind domain: ${APP_DOMAIN}`);
    try {
      const preview = await postJson("/app/domain/preview", {
        app_tid: APP_TID,
        domain: APP_DOMAIN,
      });
      console.log("  preview ok:", JSON.stringify(preview, null, 2).slice(0, 400));
      const auto = preview?.auto_active || preview?.shortcut;
      if (!DRY_RUN) {
        const added = await postJson("/app/domain/add", {
          app_tid: APP_TID,
          domain: APP_DOMAIN,
        });
        console.log("  added:", added?.tid ?? added);
        if (added?.tid && !added.active) {
          const ver = await postJson("/app/domain/verify", {
            app_tid: APP_TID,
            tid: added.tid,
          });
          console.log("  verify:", ver?.active ? "active" : ver);
        }
      } else {
        console.log("  (dry-run) skipping add/verify");
      }
    } catch (e) {
      console.error("  domain step failed:", e.message);
      console.error("  → continuing anyway; you can retry domain bind separately.");
    }
  }

  console.log("");
  if (failures.length === 0) {
    console.log("✓ DEPLOY COMPLETE");
  } else {
    console.log(`⚠ DEPLOY COMPLETE WITH ${failures.length} FAILURE(S):`);
    for (const f of failures) console.log(`  - ${f.path}: ${f.err}`);
  }
  console.log(`  app_tid : ${APP_TID}`);
  if (APP_DOMAIN) console.log(`  url     : https://${APP_DOMAIN}/`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  if (e.body) console.error("  body:", JSON.stringify(e.body).slice(0, 400));
  process.exit(1);
});
