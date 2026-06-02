// Codetrail devlog viewer — client-side SQLite via sql.js (WASM).
// Loaded only on /viewer.html. Depends on global SQL from sql-wasm.js (CDN).

const SQL_CDN_LOCATE = (file) =>
  `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`;

let DB = null;
let SQL_READY = null;

function t(key, fallback) {
  const lang = document.documentElement.dataset.lang || "en";
  const dict = (window.I18N && window.I18N[lang]) || {};
  return dict[key] || fallback;
}

async function ensureSql() {
  if (SQL_READY) return SQL_READY;
  if (typeof initSqlJs !== "function") {
    throw new Error("sql.js failed to load (network?)");
  }
  SQL_READY = initSqlJs({ locateFile: SQL_CDN_LOCATE });
  return SQL_READY;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTable(headers, rows, emptyText) {
  if (!rows || rows.length === 0) {
    return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  }
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function statusTag(result) {
  const r = (result || "").toLowerCase();
  const known = ["pass", "fail", "error", "skipped", "draft", "pending", "active"];
  const cls = known.includes(r) ? r : "";
  return `<span class="tag ${cls}">${escapeHtml(result || "—")}</span>`;
}

function query(sql) {
  if (!DB) return [];
  try {
    const res = DB.exec(sql);
    if (!res || res.length === 0) return [];
    return res[0].values;
  } catch (e) {
    return [];
  }
}

function renderEvents() {
  const rows = query(
    "SELECT id, ts, kind, COALESCE(actor,''), COALESCE(ref_type,''), COALESCE(ref_id,''), COALESCE(content,'') " +
      "FROM events ORDER BY id DESC LIMIT 500"
  ).map((r) => [
    r[0],
    escapeHtml(r[1]),
    escapeHtml(r[2]),
    escapeHtml(r[3]),
    escapeHtml(r[4] && r[5] ? `${r[4]}:${r[5]}` : r[4] || r[5]),
    `<span title="${escapeHtml(r[6])}">${escapeHtml((r[6] || "").slice(0, 140))}</span>`,
  ]);
  document.getElementById("panel-events").innerHTML = renderTable(
    ["ID", "TS", "Kind", "Actor", "Ref", "Content"],
    rows,
    t("viewer.empty", "(empty)")
  );
}

function renderUCs() {
  const rows = query(
    "SELECT id, title, COALESCE(actor,''), status, created_at FROM use_cases ORDER BY id"
  ).map((r) => [
    `<code>${escapeHtml(r[0])}</code>`,
    escapeHtml(r[1]),
    escapeHtml(r[2]),
    statusTag(r[3]),
    escapeHtml(r[4]),
  ]);
  document.getElementById("panel-ucs").innerHTML = renderTable(
    ["ID", "Title", "Actor", "Status", "Created"],
    rows,
    t("viewer.empty", "(empty)")
  );
}

function renderTCs() {
  const rows = query(
    "SELECT id, COALESCE(use_case_id,''), title, status, COALESCE(last_result,''), COALESCE(last_run_at,'') FROM test_cases ORDER BY id"
  ).map((r) => [
    `<code>${escapeHtml(r[0])}</code>`,
    `<code>${escapeHtml(r[1])}</code>`,
    escapeHtml(r[2]),
    statusTag(r[3]),
    statusTag(r[4]),
    escapeHtml(r[5]),
  ]);
  document.getElementById("panel-tcs").innerHTML = renderTable(
    ["ID", "UC", "Title", "Status", "Last result", "Last run"],
    rows,
    t("viewer.empty", "(empty)")
  );
}

function renderRuns() {
  const rows = query(
    "SELECT id, test_case_id, ts, result, COALESCE(notes,'') FROM test_runs ORDER BY id DESC LIMIT 500"
  ).map((r) => [
    r[0],
    `<code>${escapeHtml(r[1])}</code>`,
    escapeHtml(r[2]),
    statusTag(r[3]),
    `<span title="${escapeHtml(r[4])}">${escapeHtml((r[4] || "").slice(0, 140))}</span>`,
  ]);
  document.getElementById("panel-runs").innerHTML = renderTable(
    ["ID", "TC", "TS", "Result", "Notes"],
    rows,
    t("viewer.empty", "(empty)")
  );
}

function renderAll() {
  renderEvents();
  renderUCs();
  renderTCs();
  renderRuns();
}

async function loadFile(file) {
  const status = document.getElementById("dropStatus");
  status.textContent = `Loading ${file.name}…`;
  try {
    const SQL = await ensureSql();
    const buf = await file.arrayBuffer();
    if (DB) {
      DB.close();
      DB = null;
    }
    DB = new SQL.Database(new Uint8Array(buf));
    document.getElementById("panels").hidden = false;
    status.textContent = `${t("viewer.loaded", "Loaded: ")}${file.name} (${file.size} B)`;
    renderAll();
  } catch (e) {
    status.textContent = t("viewer.parseErr", "Could not parse file.");
    console.error(e);
  }
}

function initDrop() {
  const dz = document.getElementById("dropZone");
  const inp = document.getElementById("fileInput");
  const pick = document.getElementById("pickBtn");
  if (!dz || !inp || !pick) return;

  pick.addEventListener("click", () => inp.click());
  inp.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadFile(f);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add("drag-over");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove("drag-over");
    })
  );
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".panel").forEach((p) => {
        p.hidden = p.id !== `panel-${target}`;
      });
    });
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function loadDemoFromUrl(url) {
  const status = document.getElementById("dropStatus");
  if (status) status.textContent = `Loading demo…`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    let bytes;
    if (url.endsWith(".json")) {
      const payload = await resp.json();
      if (payload.format !== "sqlite-b64" || !payload.data) {
        throw new Error("unexpected demo payload format");
      }
      bytes = base64ToBytes(payload.data);
    } else {
      bytes = new Uint8Array(await resp.arrayBuffer());
    }
    const SQL = await ensureSql();
    if (DB) { DB.close(); DB = null; }
    DB = new SQL.Database(bytes);
    document.getElementById("panels").hidden = false;
    if (status) status.textContent = `${t("viewer.loaded", "Loaded: ")}demo (${bytes.byteLength} B)`;
    renderAll();
  } catch (e) {
    if (status) status.textContent = `Demo load failed: ${e.message}`;
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initDrop();
  initTabs();
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") {
    loadDemoFromUrl("/demo-devlog.json");
  }
});

// Expose I18N for cross-file lookup if script.js loaded first
window.I18N = window.I18N || {};
