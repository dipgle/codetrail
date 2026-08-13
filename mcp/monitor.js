#!/usr/bin/env node
// Real-time terminal dashboard for project-agent devlog.
// Polls the SQLite DB every 2s and redraws the screen.
//
// Read-only: opens the devlog and renders it. Never writes. Safe to run in a
// second terminal alongside a live Claude session.
//
// REQUIRES Node 22+ — uses the built-in `node:sqlite` (still flagged
// experimental, hence the startup warning), so it needs no npm install and no
// native build. The MCP servers under project-agent-node/ use better-sqlite3
// instead and run on Node 20+; only this dashboard has the higher floor.
//
// Usage:
//   PROJECT_LOG_DIR=/path/to/project/logs node mcp/monitor.js
//   node mcp/monitor.js /path/to/devlog.sqlite

import { DatabaseSync } from "node:sqlite";
import path from "path";
import { existsSync } from "fs";

const DB_PATH = process.argv[2] || path.join(
    process.env.PROJECT_LOG_DIR || path.join(process.cwd(), "logs"),
    "devlog.sqlite"
);

const REFRESH_MS = 2000;

const C = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
    cyan: "\x1b[36m", blue: "\x1b[34m",
};

function pad(s, n) { return String(s ?? "").slice(0, n).padEnd(n); }
function rpad(s, n) { return String(s ?? "").slice(0, n).padStart(n); }

function render(db) {
    const now = new Date().toLocaleTimeString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const lines = [];
    const W = 64;

    // --- Header ---
    // Interior width is W. The row spends 17 cols on "  PROJECT MONITOR",
    // now.length on the clock, and 2 on the right gutter — so the filler is
    // what's left of W after all three, not after the first two. Getting this
    // wrong renders the row 2 columns wider than the ═ borders above and below.
    const headFill = Math.max(1, W - 17 - now.length - 2);
    lines.push(`${C.bold}╔${"═".repeat(W)}╗${C.reset}`);
    lines.push(`${C.bold}║  PROJECT MONITOR${" ".repeat(headFill)}${now}  ║${C.reset}`);
    lines.push(`${C.bold}╚${"═".repeat(W)}╝${C.reset}`);
    lines.push("");

    // --- Health ---
    const staleUcs = db.prepare(
        `SELECT id FROM use_cases WHERE status='active' AND updated_at < ?`
    ).all(threeDaysAgo);

    const failingTcs = db.prepare(
        `SELECT id FROM test_cases WHERE last_result='fail'`
    ).all();

    const untestedUcs = db.prepare(`
        SELECT uc.id FROM use_cases uc WHERE uc.status IN ('draft','active')
        AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.use_case_id=uc.id)
    `).all();

    const untestedTcs = db.prepare(
        `SELECT id FROM test_cases WHERE last_run_at IS NULL`
    ).all();

    const recurringFails = db.prepare(`
        SELECT tc.id, COUNT(*) AS n FROM test_cases tc
        JOIN test_runs tr ON tr.test_case_id=tc.id AND tr.result='fail'
        WHERE tc.last_result='fail' GROUP BY tc.id HAVING COUNT(*)>=3
    `).all();

    const warnings = [
        ...recurringFails.map(t => `${t.id} failed ${t.n}× without fix`),
        ...staleUcs.map(u => `${u.id} stale (>3d no progress)`),
        ...untestedUcs.map(u => `${u.id} has no test cases`),
        ...untestedTcs.map(t => `${t.id} never executed`),
    ];

    const healthLine = warnings.length > 0
        ? `${C.yellow}⚠  ${warnings.length} warning(s)${C.reset}`
        : `${C.green}✓  all clear${C.reset}`;
    lines.push(`${C.bold}HEALTH${C.reset}  ${healthLine}`);
    for (const w of warnings.slice(0, 6)) lines.push(`  ${C.yellow}• ${w}${C.reset}`);
    if (warnings.length > 6) lines.push(`  ${C.dim}… ${warnings.length - 6} more${C.reset}`);
    lines.push("");

    // --- Active UCs ---
    const activeUcs = db.prepare(
        `SELECT * FROM use_cases WHERE status='active' ORDER BY id`
    ).all();
    lines.push(`${C.bold}ACTIVE USE CASES (${activeUcs.length})${C.reset}`);
    if (activeUcs.length === 0) {
        lines.push(`  ${C.dim}(none)${C.reset}`);
    } else {
        for (const uc of activeUcs) {
            const tcs = db.prepare(`SELECT * FROM test_cases WHERE use_case_id=?`).all(uc.id);
            const nPass = tcs.filter(t => t.last_result === "pass").length;
            const nFail = tcs.filter(t => t.last_result === "fail").length;
            const tcStatus = tcs.length === 0
                ? `${C.yellow}no tests${C.reset}`
                : nFail > 0
                    ? `${C.red}✗ ${nFail} fail${C.reset}`
                    : `${C.green}✓ ${nPass}/${tcs.length}${C.reset}`;
            lines.push(`  ${C.cyan}${pad(uc.id, 8)}${C.reset}  ${pad(uc.title, 32)}  ${tcStatus}`);
        }
    }
    lines.push("");

    // --- Recent Events ---
    const events = db.prepare(
        `SELECT * FROM events ORDER BY id DESC LIMIT 14`
    ).all();
    lines.push(`${C.bold}RECENT EVENTS${C.reset}`);
    if (events.length === 0) {
        lines.push(`  ${C.dim}(none yet)${C.reset}`);
    } else {
        for (const e of events) {
            const ts = (e.ts || "").slice(11, 19);
            const kindColor = e.kind === "decision" ? C.cyan
                : e.kind === "test_run" ? (String(e.content).includes('"fail"') ? C.red : C.green)
                : e.kind === "action" ? C.blue
                : C.reset;
            const ref = e.ref_id ? pad(e.ref_id, 8) : " ".repeat(8);
            const preview = String(e.content || "").replace(/[\n\r]/g, " ").slice(0, 24);
            lines.push(`  ${C.dim}${ts}${C.reset}  ${kindColor}${pad(e.kind, 10)}${C.reset}  ${ref}  ${C.dim}${preview}${C.reset}`);
        }
    }
    lines.push("");

    // --- Test Summary ---
    const s = db.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN last_result='pass' THEN 1 ELSE 0 END) AS pass,
               SUM(CASE WHEN last_result='fail' THEN 1 ELSE 0 END) AS fail,
               SUM(CASE WHEN last_run_at IS NULL THEN 1 ELSE 0 END) AS pending
        FROM test_cases
    `).get();
    lines.push(`${C.bold}TEST SUMMARY${C.reset}`);
    if (!s || s.total === 0) {
        lines.push(`  ${C.dim}No test cases yet${C.reset}`);
    } else {
        lines.push(
            `  Total: ${s.total}  ` +
            `${C.green}Pass: ${s.pass ?? 0}${C.reset}  ` +
            `${C.red}Fail: ${s.fail ?? 0}${C.reset}  ` +
            `Pending: ${s.pending ?? 0}`
        );
    }
    lines.push("");

    // --- Sessions ---
    const sessions = db.prepare(`SELECT COUNT(*) AS n FROM sessions`).get();
    lines.push(`${C.dim}Sessions: ${sessions?.n ?? 0}  DB: ${DB_PATH}  Refresh: ${REFRESH_MS}ms  Ctrl+C exit${C.reset}`);

    return lines.join("\n");
}

let db = null;

function tick() {
    if (!db) {
        if (!existsSync(DB_PATH)) {
            process.stdout.write("\x1b[2J\x1b[H");
            process.stdout.write(`${C.dim}Waiting for devlog at:\n  ${DB_PATH}\n${C.reset}`);
            return;
        }
        db = new DatabaseSync(DB_PATH);
    }

    try {
        const output = render(db);
        process.stdout.write("\x1b[2J\x1b[H");
        process.stdout.write(output + "\n");
    } catch (e) {
        process.stdout.write("\x1b[2J\x1b[H");
        process.stdout.write(`${C.red}Error: ${e.message}${C.reset}\n`);
    }
}

process.on("SIGINT", () => { process.stdout.write("\x1b[2J\x1b[H"); process.exit(0); });

tick();
setInterval(tick, REFRESH_MS);
