#!/usr/bin/env node
// Register or update a public-form schema on a tfl5 app.
// Idempotent: jsonb_set under apps.acls.public_forms[form_id].
//
// Inputs (env):
//   TFL5_HOST   — base URL, e.g. https://cpanel.tafalo.com
//   TFL5_USER   — Designer+ on APP_TID
//   TFL5_PASS
//   APP_TID     — target app
//   FORM_ID     — form key (default: "waitlist")
//   SCHEMA_JSON — optional inline JSON; defaults to the codetrail waitlist
//                 schema (single required email, 256-char cap, 5/IP/hr).

const HOST = process.env.TFL5_HOST?.replace(/\/+$/, "");
const USER = process.env.TFL5_USER;
const PASS = process.env.TFL5_PASS;
const APP_TID = process.env.APP_TID;
const FORM_ID = process.env.FORM_ID || "waitlist";

if (!HOST || !USER || !PASS || !APP_TID) {
  console.error("Missing TFL5_HOST / TFL5_USER / TFL5_PASS / APP_TID");
  process.exit(2);
}

const schema = process.env.SCHEMA_JSON
  ? JSON.parse(process.env.SCHEMA_JSON)
  : {
      fields: { email: { type: "email", required: true, max_len: 256 } },
      rate_per_ip_per_hour: 5,
      max_total_submissions: 10000,
      allow_unknown_fields: false,
    };

const cookies = new Map();
function applySetCookie(res) {
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

async function postJson(path, body) {
  const headers = { "content-type": "application/json" };
  const ck = cookieHeader();
  if (ck) headers.cookie = ck;
  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  applySetCookie(res);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  console.log(`▶ host    : ${HOST}`);
  console.log(`▶ user    : ${USER}`);
  console.log(`▶ app_tid : ${APP_TID}`);
  console.log(`▶ form_id : ${FORM_ID}`);
  console.log(`▶ schema  : ${JSON.stringify(schema)}`);
  console.log("");

  console.log("→ login…");
  const login = await postJson("/login", { username: USER, password: PASS });
  if (!login.ok) {
    console.error(`  login failed: HTTP ${login.status} ${login.text.slice(0, 200)}`);
    process.exit(1);
  }
  console.log("  ok");

  console.log("→ set-config…");
  const r = await postJson("/admin/public-form/set-config", {
    app_tid: APP_TID,
    form_id: FORM_ID,
    schema,
  });
  if (!r.ok) {
    console.error(`  set-config failed: HTTP ${r.status}`);
    console.error("  body:", JSON.stringify(r.json).slice(0, 400));
    process.exit(1);
  }
  console.log("  ok:", JSON.stringify(r.json).slice(0, 300));
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
