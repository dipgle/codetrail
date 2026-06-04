// Devlog: SQLite-backed event log + use-case / test-case store.
// Ported 1:1 from devlog.rs — identical schema and semantics.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  summary     TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER REFERENCES sessions(id),
  ts          TEXT NOT NULL,
  kind        TEXT NOT NULL,
  actor       TEXT,
  ref_type    TEXT,
  ref_id      TEXT,
  content     TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ref     ON events(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_events_kind    ON events(kind);

CREATE TABLE IF NOT EXISTS use_cases (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  actor         TEXT,
  preconditions TEXT,
  main_flow     TEXT,
  alt_flow      TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_cases (
  id            TEXT PRIMARY KEY,
  use_case_id   TEXT REFERENCES use_cases(id),
  title         TEXT NOT NULL,
  steps         TEXT,
  expected      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  last_run_at   TEXT,
  last_result   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_test_cases_uc ON test_cases(use_case_id);

CREATE TABLE IF NOT EXISTS test_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id  TEXT NOT NULL REFERENCES test_cases(id),
  session_id    INTEGER REFERENCES sessions(id),
  ts            TEXT NOT NULL,
  result        TEXT NOT NULL,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_runs_tc ON test_runs(test_case_id);

CREATE TABLE IF NOT EXISTS inbox (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                TEXT NOT NULL,
  sender_project    TEXT NOT NULL,
  recipient_project TEXT NOT NULL,
  kind              TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'normal',
  ref_type          TEXT,
  ref_id            TEXT,
  content           TEXT,
  status            TEXT NOT NULL DEFAULT 'unread',
  resolved_ts       TEXT,
  resolved_by       TEXT,
  resolution        TEXT
);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
CREATE INDEX IF NOT EXISTS idx_inbox_ref    ON inbox(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_inbox_sender ON inbox(sender_project);
`;

const VALID_INBOX_PRIORITIES = ["urgent", "high", "normal", "low"] as const;

const VALID_RUN_RESULTS = ["pass", "fail", "error", "skipped"] as const;
type RunResult = (typeof VALID_RUN_RESULTS)[number];

// --- Row types --------------------------------------------------------------

export interface EventRow {
  id: number;
  session_id: number | null;
  ts: string;
  kind: string;
  actor: string | null;
  ref_type: string | null;
  ref_id: string | null;
  content: string | null;
}

export interface UseCaseRow {
  id: string;
  title: string;
  actor: string | null;
  preconditions: string | null;
  main_flow: string | null;
  alt_flow: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TestCaseRow {
  id: string;
  use_case_id: string | null;
  title: string;
  steps: string | null;
  expected: string | null;
  status: string;
  last_run_at: string | null;
  last_result: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: number;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
}

export interface UcLite {
  id: string;
  title: string;
  updated_at: string;
}

export interface UcShort {
  id: string;
  title: string;
}

export interface TcLite {
  id: string;
  title: string;
  use_case_id: string | null;
  created_at: string;
}

export interface FailingTc {
  id: string;
  title: string;
  use_case_id: string | null;
  last_run_at: string | null;
  fail_count: number;
}

export interface RecurringFail {
  id: string;
  title: string;
  fail_count: number;
}

export interface Health {
  stale_ucs: UcLite[];
  failing_tcs: FailingTc[];
  untested_tcs: TcLite[];
  untested_ucs: UcShort[];
  recurring_fails: RecurringFail[];
  warnings: string[];
}

export interface ContextBrief {
  summary: string;
  active_ucs: UseCaseRow[];
  health_warnings: string[];
  failing_tests: FailingTc[];
  untested_tcs: TcLite[];
  recent_decisions: EventRow[];
  last_session: SessionRow | null;
}

export interface NextTcFull {
  id: string;
  title: string;
  use_case_id: string | null;
  last_run_at: string | null;
  uc_title: string;
  main_flow: string | null;
  steps: string | null;
  expected: string | null;
  created_at: string | null;
}

export interface InboxRow {
  id: number;
  ts: string;
  sender_project: string;
  recipient_project: string;
  kind: string;
  priority: string;
  ref_type: string | null;
  ref_id: string | null;
  content: string | null;
  status: string;
  resolved_ts: string | null;
  resolved_by: string | null;
  resolution: string | null;
}

export interface MissingTcUc {
  id: string;
  title: string;
  main_flow: string | null;
  created_at: string;
}

export type NextTask =
  | { type: "failing_test"; tc: NextTcFull; reason: string; next_action: string }
  | { type: "untested_tc"; tc: NextTcFull; reason: string; next_action: string }
  | { type: "missing_tc"; uc: MissingTcUc; reason: string; next_action: string }
  | { type: "all_clear"; message: string };

// --- Devlog -----------------------------------------------------------------

export class Devlog {
  private db: Database.Database;
  private sessionId: number | null = null;

  constructor(public readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(SCHEMA);
  }

  private now(): string {
    return new Date().toISOString();
  }

  private getSessionId(): number {
    if (this.sessionId !== null) return this.sessionId;
    const info = this.db
      .prepare("INSERT INTO sessions (started_at) VALUES (?)")
      .run(this.now());
    this.sessionId = Number(info.lastInsertRowid);
    return this.sessionId;
  }

  logEvent(
    kind: string,
    actor: string | null,
    refType: string | null,
    refId: string | null,
    content: string | null
  ): number {
    const sid = this.getSessionId();
    const info = this.db
      .prepare(
        `INSERT INTO events
           (session_id, ts, kind, actor, ref_type, ref_id, content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(sid, this.now(), kind, actor, refType, refId, content);
    return Number(info.lastInsertRowid);
  }

  upsertUseCase(
    id: string,
    title: string,
    actor: string | null,
    preconditions: string | null,
    mainFlow: string | null,
    altFlow: string | null,
    status: string
  ): string {
    const ts = this.now();
    this.db
      .prepare(
        `INSERT INTO use_cases
           (id, title, actor, preconditions, main_flow, alt_flow,
            status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           actor = excluded.actor,
           preconditions = excluded.preconditions,
           main_flow = excluded.main_flow,
           alt_flow = excluded.alt_flow,
           status = excluded.status,
           updated_at = excluded.updated_at`
      )
      .run(id, title, actor, preconditions, mainFlow, altFlow, status, ts, ts);
    this.logEvent(
      "use_case",
      "assistant",
      "use_case",
      id,
      JSON.stringify({ title, status })
    );
    return id;
  }

  upsertTestCase(
    id: string,
    useCaseId: string,
    title: string,
    steps: string | null,
    expected: string | null,
    status: string
  ): string {
    const ts = this.now();
    this.db
      .prepare(
        `INSERT INTO test_cases
           (id, use_case_id, title, steps, expected, status,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           use_case_id = excluded.use_case_id,
           title = excluded.title,
           steps = excluded.steps,
           expected = excluded.expected,
           status = excluded.status,
           updated_at = excluded.updated_at`
      )
      .run(id, useCaseId, title, steps, expected, status, ts, ts);
    this.logEvent(
      "test_case",
      "assistant",
      "test_case",
      id,
      JSON.stringify({ useCaseId, title, status })
    );
    return id;
  }

  recordTestRun(
    testCaseId: string,
    result: string,
    notes: string | null
  ): number {
    if (!(VALID_RUN_RESULTS as readonly string[]).includes(result)) {
      throw new Error(`invalid result: ${result}`);
    }
    const ts = this.now();
    const sid = this.getSessionId();
    const info = this.db
      .prepare(
        `INSERT INTO test_runs
           (test_case_id, session_id, ts, result, notes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(testCaseId, sid, ts, result, notes);
    const runId = Number(info.lastInsertRowid);
    const status = result === "pass" ? "pass" : "fail";
    this.db
      .prepare(
        `UPDATE test_cases
           SET last_run_at = ?, last_result = ?, status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(ts, result, status, ts, testCaseId);
    this.logEvent(
      "test_run",
      "assistant",
      "test_case",
      testCaseId,
      JSON.stringify({ result, notes })
    );
    return runId;
  }

  listUseCases(status: string | null): UseCaseRow[] {
    const sql = status
      ? `SELECT id, title, actor, preconditions, main_flow, alt_flow,
                status, created_at, updated_at
         FROM use_cases WHERE status = ? ORDER BY id`
      : `SELECT id, title, actor, preconditions, main_flow, alt_flow,
                status, created_at, updated_at
         FROM use_cases ORDER BY id`;
    const stmt = this.db.prepare(sql);
    return (status ? stmt.all(status) : stmt.all()) as UseCaseRow[];
  }

  listTestCases(
    useCaseId: string | null,
    status: string | null
  ): TestCaseRow[] {
    const clauses: string[] = [];
    const args: string[] = [];
    if (useCaseId) {
      clauses.push("use_case_id = ?");
      args.push(useCaseId);
    }
    if (status) {
      clauses.push("status = ?");
      args.push(status);
    }
    let sql = `SELECT id, use_case_id, title, steps, expected, status,
                      last_run_at, last_result, created_at, updated_at
               FROM test_cases`;
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY id";
    return this.db.prepare(sql).all(...args) as TestCaseRow[];
  }

  recentEvents(limit: number, kind: string | null): EventRow[] {
    const sql = kind
      ? `SELECT id, session_id, ts, kind, actor, ref_type, ref_id, content
         FROM events WHERE kind = ? ORDER BY id DESC LIMIT ?`
      : `SELECT id, session_id, ts, kind, actor, ref_type, ref_id, content
         FROM events ORDER BY id DESC LIMIT ?`;
    const stmt = this.db.prepare(sql);
    return (
      kind ? stmt.all(kind, limit) : stmt.all(limit)
    ) as EventRow[];
  }

  scanHealth(): Health {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 3600 * 1000
    ).toISOString();

    const stale_ucs = this.db
      .prepare(
        `SELECT id, title, updated_at FROM use_cases
         WHERE status='active' AND updated_at < ?
         ORDER BY updated_at ASC`
      )
      .all(threeDaysAgo) as UcLite[];

    const failing_tcs = this.db
      .prepare(
        `SELECT tc.id, tc.title, tc.use_case_id, tc.last_run_at,
                (SELECT COUNT(*) FROM test_runs tr
                 WHERE tr.test_case_id = tc.id AND tr.result='fail') AS fail_count
         FROM test_cases tc
         WHERE tc.last_result='fail'
         ORDER BY fail_count DESC`
      )
      .all() as FailingTc[];

    const untested_tcs = this.db
      .prepare(
        `SELECT id, title, use_case_id, created_at FROM test_cases
         WHERE last_run_at IS NULL ORDER BY created_at ASC`
      )
      .all() as TcLite[];

    const untested_ucs = this.db
      .prepare(
        `SELECT uc.id, uc.title FROM use_cases uc
         WHERE uc.status IN ('draft','active')
           AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.use_case_id = uc.id)
         ORDER BY uc.id`
      )
      .all() as UcShort[];

    const recurring_fails = this.db
      .prepare(
        `SELECT tc.id, tc.title, COUNT(*) AS fail_count
         FROM test_cases tc
         JOIN test_runs tr ON tr.test_case_id = tc.id AND tr.result='fail'
         WHERE tc.last_result='fail'
         GROUP BY tc.id HAVING COUNT(*) >= 3
         ORDER BY fail_count DESC`
      )
      .all() as RecurringFail[];

    const warnings: string[] = [];
    for (const t of recurring_fails) {
      warnings.push(`${t.id} failed ${t.fail_count}× without resolution`);
    }
    for (const u of stale_ucs) {
      warnings.push(`${u.id} active but stale since ${u.updated_at.slice(0, 10)}`);
    }
    for (const u of untested_ucs) {
      warnings.push(`${u.id} has no test cases`);
    }
    for (const t of untested_tcs) {
      warnings.push(`${t.id} never executed`);
    }

    return {
      stale_ucs,
      failing_tcs,
      untested_tcs,
      untested_ucs,
      recurring_fails,
      warnings,
    };
  }

  getContextBrief(): ContextBrief {
    const health = this.scanHealth();
    const active_ucs = this.listUseCases("active");
    const recent_decisions = this.recentEvents(10, "decision");
    const last_session = this.lastSession();
    const summary = `${active_ucs.length} active UCs · ${health.warnings.length} warnings · ${health.failing_tcs.length} failing tests`;
    return {
      summary,
      active_ucs,
      health_warnings: health.warnings,
      failing_tests: health.failing_tcs,
      untested_tcs: health.untested_tcs,
      recent_decisions,
      last_session,
    };
  }

  nextTask(): NextTask {
    const failing = this.db
      .prepare(
        `SELECT tc.id, tc.title, tc.use_case_id, tc.last_run_at,
                uc.title AS uc_title, uc.main_flow
         FROM test_cases tc
         JOIN use_cases uc ON uc.id = tc.use_case_id
         WHERE tc.last_result='fail' AND uc.status IN ('active','draft')
         ORDER BY tc.last_run_at ASC LIMIT 1`
      )
      .get() as
      | (Omit<NextTcFull, "steps" | "expected" | "created_at"> & {})
      | undefined;

    if (failing) {
      const day = (failing.last_run_at ?? "").slice(0, 10);
      const tc: NextTcFull = {
        id: failing.id,
        title: failing.title,
        use_case_id: failing.use_case_id,
        last_run_at: failing.last_run_at,
        uc_title: failing.uc_title,
        main_flow: failing.main_flow,
        steps: null,
        expected: null,
        created_at: null,
      };
      return {
        type: "failing_test",
        tc,
        reason: `TC last run at (${day})`,
        next_action:
          "Diagnose root cause, fix code (not the test), record_test_run with result='pass'",
      };
    }

    const untested = this.db
      .prepare(
        `SELECT tc.id, tc.title, tc.use_case_id, tc.steps, tc.expected, tc.created_at,
                uc.title AS uc_title, uc.main_flow
         FROM test_cases tc
         JOIN use_cases uc ON uc.id = tc.use_case_id
         WHERE tc.last_run_at IS NULL AND uc.status='active'
         ORDER BY tc.created_at ASC LIMIT 1`
      )
      .get() as
      | (Omit<NextTcFull, "last_run_at"> & {})
      | undefined;

    if (untested) {
      const day = (untested.created_at ?? "").slice(0, 10);
      const tc: NextTcFull = {
        id: untested.id,
        title: untested.title,
        use_case_id: untested.use_case_id,
        last_run_at: null,
        uc_title: untested.uc_title,
        main_flow: untested.main_flow,
        steps: untested.steps,
        expected: untested.expected,
        created_at: untested.created_at,
      };
      return {
        type: "untested_tc",
        tc,
        reason: `TC ${untested.id} never executed (created ${day})`,
        next_action:
          "Run the test now to record RED proof, then implement code to GREEN",
      };
    }

    const uc = this.db
      .prepare(
        `SELECT id, title, main_flow, created_at FROM use_cases
         WHERE status='active'
           AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.use_case_id = use_cases.id)
         ORDER BY created_at ASC LIMIT 1`
      )
      .get() as MissingTcUc | undefined;

    if (uc) {
      const reason = `UC ${uc.id} is active but has no test cases`;
      const next_action = uc.main_flow
        ? "Derive TC from main_flow (1 happy path minimum), then create_test_case"
        : "Write main_flow first, then derive TC from it";
      return { type: "missing_tc", uc, reason, next_action };
    }

    return {
      type: "all_clear",
      message:
        "No pending work signals found. Consider exploratory testing or new UC.",
    };
  }

  // --- Inbox (cross-project messaging) ---

  sendInboxMessage(
    senderProject: string,
    recipientProject: string,
    kind: string,
    priority: string,
    refType: string | null,
    refId: string | null,
    content: string | null
  ): number {
    if (!(VALID_INBOX_PRIORITIES as readonly string[]).includes(priority)) {
      throw new Error(`invalid priority: ${priority} (use urgent|high|normal|low)`);
    }
    const info = this.db
      .prepare(
        `INSERT INTO inbox
           (ts, sender_project, recipient_project, kind, priority,
            ref_type, ref_id, content, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unread')`
      )
      .run(this.now(), senderProject, recipientProject, kind, priority, refType, refId, content);
    return Number(info.lastInsertRowid);
  }

  listInbox(
    status: string | null,
    sender: string | null,
    limit: number
  ): InboxRow[] {
    const clauses: string[] = [];
    const args: (string | number)[] = [];
    if (status) {
      clauses.push("status = ?");
      args.push(status);
    }
    if (sender) {
      clauses.push("sender_project = ?");
      args.push(sender);
    }
    let sql = `SELECT id, ts, sender_project, recipient_project, kind, priority,
                      ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
               FROM inbox`;
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, id DESC LIMIT ?";
    args.push(limit);
    return this.db.prepare(sql).all(...args) as InboxRow[];
  }

  markInboxResolved(
    inboxId: number,
    resolvedBy: string,
    resolution: string | null
  ): boolean {
    const info = this.db
      .prepare(
        `UPDATE inbox
           SET status = 'resolved',
               resolved_ts = ?,
               resolved_by = ?,
               resolution = ?
         WHERE id = ?`
      )
      .run(this.now(), resolvedBy, resolution, inboxId);
    return info.changes > 0;
  }

  markInboxRead(inboxId: number): boolean {
    const info = this.db
      .prepare(
        `UPDATE inbox SET status = 'read' WHERE id = ? AND status = 'unread'`
      )
      .run(inboxId);
    return info.changes > 0;
  }

  getInboxThread(refType: string | null, refId: string): InboxRow[] {
    const sql = refType
      ? `SELECT id, ts, sender_project, recipient_project, kind, priority,
                ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
         FROM inbox WHERE ref_type = ? AND ref_id = ? ORDER BY id ASC`
      : `SELECT id, ts, sender_project, recipient_project, kind, priority,
                ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
         FROM inbox WHERE ref_id = ? ORDER BY id ASC`;
    const stmt = this.db.prepare(sql);
    return (refType ? stmt.all(refType, refId) : stmt.all(refId)) as InboxRow[];
  }

  lastSession(): SessionRow | null {
    const row = this.db
      .prepare(
        "SELECT id, started_at, ended_at, summary FROM sessions ORDER BY id DESC LIMIT 1"
      )
      .get() as SessionRow | undefined;
    return row ?? null;
  }
}
