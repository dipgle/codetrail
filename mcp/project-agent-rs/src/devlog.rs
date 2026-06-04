// Devlog: SQLite-backed event log + use-case / test-case store.
// Ported from devlog.js with identical schema and semantics.

use anyhow::{anyhow, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const SCHEMA: &str = r#"
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
"#;

const VALID_INBOX_PRIORITIES: &[&str] = &["urgent", "high", "normal", "low"];

pub struct Devlog {
    conn: Mutex<Connection>,
    db_path: PathBuf,
    session_id: Mutex<Option<i64>>,
}

impl Devlog {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let db_path = path.as_ref().to_path_buf();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(&db_path)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self {
            conn: Mutex::new(conn),
            db_path,
            session_id: Mutex::new(None),
        })
    }

    pub fn db_path(&self) -> String {
        self.db_path.display().to_string()
    }

    fn now() -> String {
        Utc::now().to_rfc3339()
    }

    fn get_session_id(&self) -> Result<i64> {
        let mut sid = self.session_id.lock().unwrap();
        if let Some(id) = *sid {
            return Ok(id);
        }
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sessions (started_at) VALUES (?1)",
            params![Self::now()],
        )?;
        let id = conn.last_insert_rowid();
        *sid = Some(id);
        Ok(id)
    }

    pub fn log_event(
        &self,
        kind: &str,
        actor: Option<&str>,
        ref_type: Option<&str>,
        ref_id: Option<&str>,
        content: Option<&str>,
    ) -> Result<i64> {
        let session_id = self.get_session_id()?;
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"INSERT INTO events
                 (session_id, ts, kind, actor, ref_type, ref_id, content)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
            params![session_id, Self::now(), kind, actor, ref_type, ref_id, content],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn upsert_use_case(
        &self,
        id: &str,
        title: &str,
        actor: Option<&str>,
        preconditions: Option<&str>,
        main_flow: Option<&str>,
        alt_flow: Option<&str>,
        status: &str,
    ) -> Result<String> {
        let ts = Self::now();
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                r#"INSERT INTO use_cases
                     (id, title, actor, preconditions, main_flow, alt_flow,
                      status, created_at, updated_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                   ON CONFLICT(id) DO UPDATE SET
                     title = excluded.title,
                     actor = excluded.actor,
                     preconditions = excluded.preconditions,
                     main_flow = excluded.main_flow,
                     alt_flow = excluded.alt_flow,
                     status = excluded.status,
                     updated_at = excluded.updated_at"#,
                params![id, title, actor, preconditions, main_flow, alt_flow, status, ts, ts],
            )?;
        }
        self.log_event(
            "use_case",
            Some("assistant"),
            Some("use_case"),
            Some(id),
            Some(&format!(r#"{{"title":"{}","status":"{}"}}"#, title, status)),
        )?;
        Ok(id.to_string())
    }

    pub fn upsert_test_case(
        &self,
        id: &str,
        use_case_id: &str,
        title: &str,
        steps: Option<&str>,
        expected: Option<&str>,
        status: &str,
    ) -> Result<String> {
        let ts = Self::now();
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                r#"INSERT INTO test_cases
                     (id, use_case_id, title, steps, expected, status,
                      created_at, updated_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                   ON CONFLICT(id) DO UPDATE SET
                     use_case_id = excluded.use_case_id,
                     title = excluded.title,
                     steps = excluded.steps,
                     expected = excluded.expected,
                     status = excluded.status,
                     updated_at = excluded.updated_at"#,
                params![id, use_case_id, title, steps, expected, status, ts, ts],
            )?;
        }
        self.log_event(
            "test_case",
            Some("assistant"),
            Some("test_case"),
            Some(id),
            Some(&format!(
                r#"{{"useCaseId":"{}","title":"{}","status":"{}"}}"#,
                use_case_id, title, status
            )),
        )?;
        Ok(id.to_string())
    }

    pub fn record_test_run(
        &self,
        test_case_id: &str,
        result: &str,
        notes: Option<&str>,
    ) -> Result<i64> {
        if !["pass", "fail", "error", "skipped"].contains(&result) {
            return Err(anyhow!("invalid result: {}", result));
        }
        let ts = Self::now();
        let session_id = self.get_session_id()?;
        let run_id = {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                r#"INSERT INTO test_runs
                     (test_case_id, session_id, ts, result, notes)
                   VALUES (?1, ?2, ?3, ?4, ?5)"#,
                params![test_case_id, session_id, ts, result, notes],
            )?;
            let id = conn.last_insert_rowid();
            let status = if result == "pass" { "pass" } else { "fail" };
            conn.execute(
                r#"UPDATE test_cases
                   SET last_run_at = ?1, last_result = ?2, status = ?3, updated_at = ?4
                   WHERE id = ?5"#,
                params![ts, result, status, ts, test_case_id],
            )?;
            id
        };
        self.log_event(
            "test_run",
            Some("assistant"),
            Some("test_case"),
            Some(test_case_id),
            Some(&format!(
                r#"{{"result":"{}","notes":{}}}"#,
                result,
                notes.map(|n| format!("\"{}\"", n.replace('"', "\\\""))).unwrap_or_else(|| "null".to_string())
            )),
        )?;
        Ok(run_id)
    }

    pub fn list_use_cases(&self, status: Option<&str>) -> Result<Vec<UseCase>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = if status.is_some() {
            conn.prepare("SELECT id, title, actor, preconditions, main_flow, alt_flow, status, created_at, updated_at FROM use_cases WHERE status = ?1 ORDER BY id")?
        } else {
            conn.prepare("SELECT id, title, actor, preconditions, main_flow, alt_flow, status, created_at, updated_at FROM use_cases ORDER BY id")?
        };
        let map = |row: &rusqlite::Row| -> rusqlite::Result<UseCase> {
            Ok(UseCase {
                id: row.get(0)?,
                title: row.get(1)?,
                actor: row.get(2)?,
                preconditions: row.get(3)?,
                main_flow: row.get(4)?,
                alt_flow: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        };
        let rows = if let Some(s) = status {
            stmt.query_map(params![s], map)?.collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map([], map)?.collect::<Result<Vec<_>, _>>()?
        };
        Ok(rows)
    }

    pub fn list_test_cases(
        &self,
        use_case_id: Option<&str>,
        status: Option<&str>,
    ) -> Result<Vec<TestCase>> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from("SELECT id, use_case_id, title, steps, expected, status, last_run_at, last_result, created_at, updated_at FROM test_cases");
        let mut clauses = Vec::new();
        if use_case_id.is_some() {
            clauses.push("use_case_id = ?");
        }
        if status.is_some() {
            clauses.push("status = ?");
        }
        if !clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&clauses.join(" AND "));
        }
        sql.push_str(" ORDER BY id");
        let mut stmt = conn.prepare(&sql)?;
        let map = |row: &rusqlite::Row| -> rusqlite::Result<TestCase> {
            Ok(TestCase {
                id: row.get(0)?,
                use_case_id: row.get(1)?,
                title: row.get(2)?,
                steps: row.get(3)?,
                expected: row.get(4)?,
                status: row.get(5)?,
                last_run_at: row.get(6)?,
                last_result: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        };
        let rows = match (use_case_id, status) {
            (Some(u), Some(s)) => stmt.query_map(params![u, s], map)?.collect::<Result<Vec<_>, _>>()?,
            (Some(u), None) => stmt.query_map(params![u], map)?.collect::<Result<Vec<_>, _>>()?,
            (None, Some(s)) => stmt.query_map(params![s], map)?.collect::<Result<Vec<_>, _>>()?,
            (None, None) => stmt.query_map([], map)?.collect::<Result<Vec<_>, _>>()?,
        };
        Ok(rows)
    }

    pub fn recent_events(&self, limit: i64, kind: Option<&str>) -> Result<Vec<Event>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = if kind.is_some() {
            conn.prepare("SELECT id, session_id, ts, kind, actor, ref_type, ref_id, content FROM events WHERE kind = ?1 ORDER BY id DESC LIMIT ?2")?
        } else {
            conn.prepare("SELECT id, session_id, ts, kind, actor, ref_type, ref_id, content FROM events ORDER BY id DESC LIMIT ?1")?
        };
        let map = |row: &rusqlite::Row| -> rusqlite::Result<Event> {
            Ok(Event {
                id: row.get(0)?,
                session_id: row.get(1)?,
                ts: row.get(2)?,
                kind: row.get(3)?,
                actor: row.get(4)?,
                ref_type: row.get(5)?,
                ref_id: row.get(6)?,
                content: row.get(7)?,
            })
        };
        let rows = if let Some(k) = kind {
            stmt.query_map(params![k, limit], map)?.collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![limit], map)?.collect::<Result<Vec<_>, _>>()?
        };
        Ok(rows)
    }

    pub fn scan_health(&self) -> Result<Health> {
        let conn = self.conn.lock().unwrap();
        let three_days_ago = (Utc::now() - chrono::Duration::days(3)).to_rfc3339();

        let stale_ucs: Vec<UcLite> = conn
            .prepare(
                "SELECT id, title, updated_at FROM use_cases WHERE status='active' AND updated_at < ?1 ORDER BY updated_at ASC",
            )?
            .query_map(params![three_days_ago], |r| {
                Ok(UcLite {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    updated_at: r.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let failing_tcs: Vec<FailingTc> = conn
            .prepare(r#"SELECT tc.id, tc.title, tc.use_case_id, tc.last_run_at,
                          (SELECT COUNT(*) FROM test_runs tr
                           WHERE tr.test_case_id = tc.id AND tr.result='fail') AS fail_count
                        FROM test_cases tc WHERE tc.last_result='fail'
                        ORDER BY fail_count DESC"#)?
            .query_map([], |r| {
                Ok(FailingTc {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    use_case_id: r.get(2)?,
                    last_run_at: r.get(3)?,
                    fail_count: r.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let untested_tcs: Vec<TcLite> = conn
            .prepare("SELECT id, title, use_case_id, created_at FROM test_cases WHERE last_run_at IS NULL ORDER BY created_at ASC")?
            .query_map([], |r| {
                Ok(TcLite {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    use_case_id: r.get(2)?,
                    created_at: r.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let untested_ucs: Vec<UcShort> = conn
            .prepare(r#"SELECT uc.id, uc.title FROM use_cases uc
                        WHERE uc.status IN ('draft','active')
                          AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.use_case_id = uc.id)
                        ORDER BY uc.id"#)?
            .query_map([], |r| Ok(UcShort { id: r.get(0)?, title: r.get(1)? }))?
            .collect::<Result<Vec<_>, _>>()?;

        let recurring_fails: Vec<RecurringFail> = conn
            .prepare(r#"SELECT tc.id, tc.title, COUNT(*) AS fail_count
                        FROM test_cases tc
                        JOIN test_runs tr ON tr.test_case_id = tc.id AND tr.result='fail'
                        WHERE tc.last_result='fail'
                        GROUP BY tc.id HAVING COUNT(*) >= 3
                        ORDER BY fail_count DESC"#)?
            .query_map([], |r| {
                Ok(RecurringFail {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    fail_count: r.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut warnings = Vec::new();
        for t in &recurring_fails {
            warnings.push(format!("{} failed {}× without resolution", t.id, t.fail_count));
        }
        for u in &stale_ucs {
            warnings.push(format!(
                "{} active but stale since {}",
                u.id,
                u.updated_at.chars().take(10).collect::<String>()
            ));
        }
        for u in &untested_ucs {
            warnings.push(format!("{} has no test cases", u.id));
        }
        for t in &untested_tcs {
            warnings.push(format!("{} never executed", t.id));
        }

        Ok(Health {
            stale_ucs,
            failing_tcs,
            untested_tcs,
            untested_ucs,
            recurring_fails,
            warnings,
        })
    }

    pub fn get_context_brief(&self) -> Result<ContextBrief> {
        let health = self.scan_health()?;
        let active_ucs = self.list_use_cases(Some("active"))?;
        let recent_decisions = self.recent_events(10, Some("decision"))?;
        let last_session: Option<Session> = self.last_session()?;
        let inbox = self.inbox_digest()?;
        let inbox_part = if inbox.unread_count > 0 {
            format!(" · {} unread inbox", inbox.unread_count)
        } else {
            String::new()
        };
        let summary = format!(
            "{} active UCs · {} warnings · {} failing tests{}",
            active_ucs.len(),
            health.warnings.len(),
            health.failing_tcs.len(),
            inbox_part
        );
        Ok(ContextBrief {
            summary,
            active_ucs,
            health_warnings: health.warnings.clone(),
            failing_tests: health.failing_tcs.clone(),
            untested_tcs: health.untested_tcs.clone(),
            recent_decisions,
            last_session,
            inbox,
        })
    }

    fn inbox_digest(&self) -> Result<InboxDigest> {
        let top_unread = self.list_inbox(Some("unread"), None, 5)?;
        let all_unread = self.list_inbox(Some("unread"), None, 1000)?;
        let mut by_priority = InboxByPriority::default();
        for m in &all_unread {
            match m.priority.as_str() {
                "urgent" => by_priority.urgent += 1,
                "high" => by_priority.high += 1,
                "normal" => by_priority.normal += 1,
                "low" => by_priority.low += 1,
                _ => {}
            }
        }
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, ts, sender_project, recipient_project, kind, priority,
                    ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
             FROM inbox
             WHERE status = 'resolved'
               AND julianday(resolved_ts) > julianday('now', '-1 day')
             ORDER BY resolved_ts DESC LIMIT 10",
        )?;
        let map = |row: &rusqlite::Row| -> rusqlite::Result<InboxRow> {
            Ok(InboxRow {
                id: row.get(0)?,
                ts: row.get(1)?,
                sender_project: row.get(2)?,
                recipient_project: row.get(3)?,
                kind: row.get(4)?,
                priority: row.get(5)?,
                ref_type: row.get(6)?,
                ref_id: row.get(7)?,
                content: row.get(8)?,
                status: row.get(9)?,
                resolved_ts: row.get(10)?,
                resolved_by: row.get(11)?,
                resolution: row.get(12)?,
            })
        };
        let recent_resolved: Vec<InboxRow> = stmt
            .query_map([], map)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(InboxDigest {
            unread_count: all_unread.len() as i64,
            by_priority,
            top_unread,
            recent_resolved,
        })
    }

    pub fn next_task(&self) -> Result<NextTask> {
        // 1. Failing test
        let conn = self.conn.lock().unwrap();
        if let Some(failing) = conn
            .prepare(r#"SELECT tc.id, tc.title, tc.use_case_id, tc.last_run_at,
                          uc.title AS uc_title, uc.main_flow
                        FROM test_cases tc
                        JOIN use_cases uc ON uc.id = tc.use_case_id
                        WHERE tc.last_result='fail' AND uc.status IN ('active','draft')
                        ORDER BY tc.last_run_at ASC LIMIT 1"#)?
            .query_row([], |r| {
                Ok(NextTcFull {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    use_case_id: r.get(2)?,
                    last_run_at: r.get(3)?,
                    uc_title: r.get(4)?,
                    main_flow: r.get(5)?,
                    steps: None,
                    expected: None,
                    created_at: None,
                })
            })
            .ok()
        {
            let day = failing.last_run_at.as_deref().unwrap_or("").chars().take(10).collect::<String>();
            return Ok(NextTask::FailingTest {
                tc: failing,
                reason: format!("TC {} failed last run ({})", "", day).replace("TC  (", "TC last run at ("),
                next_action: "Diagnose root cause, fix code (not the test), record_test_run with result='pass'".to_string(),
            });
        }

        // 2. Untested TC
        if let Some(untested) = conn
            .prepare(r#"SELECT tc.id, tc.title, tc.use_case_id, tc.steps, tc.expected, tc.created_at,
                          uc.title AS uc_title, uc.main_flow
                        FROM test_cases tc
                        JOIN use_cases uc ON uc.id = tc.use_case_id
                        WHERE tc.last_run_at IS NULL AND uc.status='active'
                        ORDER BY tc.created_at ASC LIMIT 1"#)?
            .query_row([], |r| {
                Ok(NextTcFull {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    use_case_id: r.get(2)?,
                    steps: r.get(3)?,
                    expected: r.get(4)?,
                    created_at: r.get(5)?,
                    uc_title: r.get(6)?,
                    main_flow: r.get(7)?,
                    last_run_at: None,
                })
            })
            .ok()
        {
            let day = untested.created_at.as_deref().unwrap_or("").chars().take(10).collect::<String>();
            let reason = format!("TC {} never executed (created {})", untested.id, day);
            return Ok(NextTask::UntestedTc {
                tc: untested,
                reason,
                next_action: "Run the test now to record RED proof, then implement code to GREEN".to_string(),
            });
        }

        // 3. UC without any TC
        if let Some(uc) = conn
            .prepare(r#"SELECT id, title, main_flow, created_at FROM use_cases
                        WHERE status='active'
                          AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.use_case_id = use_cases.id)
                        ORDER BY created_at ASC LIMIT 1"#)?
            .query_row([], |r| {
                Ok(MissingTcUc {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    main_flow: r.get(2)?,
                    created_at: r.get(3)?,
                })
            })
            .ok()
        {
            let reason = format!("UC {} is active but has no test cases", uc.id);
            let next_action = if uc.main_flow.is_some() {
                "Derive TC from main_flow (1 happy path minimum), then create_test_case"
            } else {
                "Write main_flow first, then derive TC from it"
            };
            return Ok(NextTask::MissingTc {
                uc,
                reason,
                next_action: next_action.to_string(),
            });
        }

        Ok(NextTask::AllClear {
            message: "No pending work signals found. Consider exploratory testing or new UC.".to_string(),
        })
    }

    // --- Inbox (cross-project messaging) ---

    pub fn send_inbox_message(
        &self,
        sender_project: &str,
        recipient_project: &str,
        kind: &str,
        priority: &str,
        ref_type: Option<&str>,
        ref_id: Option<&str>,
        content: Option<&str>,
    ) -> Result<i64> {
        if !VALID_INBOX_PRIORITIES.contains(&priority) {
            return Err(anyhow!(
                "invalid priority: {} (use urgent|high|normal|low)",
                priority
            ));
        }
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"INSERT INTO inbox
                 (ts, sender_project, recipient_project, kind, priority,
                  ref_type, ref_id, content, status)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'unread')"#,
            params![
                Self::now(),
                sender_project,
                recipient_project,
                kind,
                priority,
                ref_type,
                ref_id,
                content
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_inbox(
        &self,
        status: Option<&str>,
        sender: Option<&str>,
        limit: i64,
    ) -> Result<Vec<InboxRow>> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT id, ts, sender_project, recipient_project, kind, priority,
                    ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
             FROM inbox",
        );
        let mut clauses = Vec::new();
        if status.is_some() {
            clauses.push("status = ?");
        }
        if sender.is_some() {
            clauses.push("sender_project = ?");
        }
        if !clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&clauses.join(" AND "));
        }
        sql.push_str(
            " ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 \
             WHEN 'normal' THEN 2 ELSE 3 END, id DESC LIMIT ?",
        );
        let mut stmt = conn.prepare(&sql)?;
        let map = |row: &rusqlite::Row| -> rusqlite::Result<InboxRow> {
            Ok(InboxRow {
                id: row.get(0)?,
                ts: row.get(1)?,
                sender_project: row.get(2)?,
                recipient_project: row.get(3)?,
                kind: row.get(4)?,
                priority: row.get(5)?,
                ref_type: row.get(6)?,
                ref_id: row.get(7)?,
                content: row.get(8)?,
                status: row.get(9)?,
                resolved_ts: row.get(10)?,
                resolved_by: row.get(11)?,
                resolution: row.get(12)?,
            })
        };
        let rows = match (status, sender) {
            (Some(st), Some(sn)) => stmt
                .query_map(params![st, sn, limit], map)?
                .collect::<Result<Vec<_>, _>>()?,
            (Some(st), None) => stmt
                .query_map(params![st, limit], map)?
                .collect::<Result<Vec<_>, _>>()?,
            (None, Some(sn)) => stmt
                .query_map(params![sn, limit], map)?
                .collect::<Result<Vec<_>, _>>()?,
            (None, None) => stmt
                .query_map(params![limit], map)?
                .collect::<Result<Vec<_>, _>>()?,
        };
        Ok(rows)
    }

    pub fn mark_inbox_resolved(
        &self,
        inbox_id: i64,
        resolved_by: &str,
        resolution: Option<&str>,
    ) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            r#"UPDATE inbox
                 SET status = 'resolved',
                     resolved_ts = ?1,
                     resolved_by = ?2,
                     resolution = ?3
               WHERE id = ?4"#,
            params![Self::now(), resolved_by, resolution, inbox_id],
        )?;
        Ok(changed > 0)
    }

    pub fn get_inbox_thread(
        &self,
        ref_type: Option<&str>,
        ref_id: &str,
    ) -> Result<Vec<InboxRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = if ref_type.is_some() {
            "SELECT id, ts, sender_project, recipient_project, kind, priority,
                    ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
             FROM inbox WHERE ref_type = ?1 AND ref_id = ?2 ORDER BY id ASC"
        } else {
            "SELECT id, ts, sender_project, recipient_project, kind, priority,
                    ref_type, ref_id, content, status, resolved_ts, resolved_by, resolution
             FROM inbox WHERE ref_id = ?1 ORDER BY id ASC"
        };
        let mut stmt = conn.prepare(sql)?;
        let map = |row: &rusqlite::Row| -> rusqlite::Result<InboxRow> {
            Ok(InboxRow {
                id: row.get(0)?,
                ts: row.get(1)?,
                sender_project: row.get(2)?,
                recipient_project: row.get(3)?,
                kind: row.get(4)?,
                priority: row.get(5)?,
                ref_type: row.get(6)?,
                ref_id: row.get(7)?,
                content: row.get(8)?,
                status: row.get(9)?,
                resolved_ts: row.get(10)?,
                resolved_by: row.get(11)?,
                resolution: row.get(12)?,
            })
        };
        let rows = if let Some(rt) = ref_type {
            stmt.query_map(params![rt, ref_id], map)?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![ref_id], map)?
                .collect::<Result<Vec<_>, _>>()?
        };
        Ok(rows)
    }

    pub fn last_session(&self) -> Result<Option<Session>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT id, started_at, ended_at, summary FROM sessions ORDER BY id DESC LIMIT 1")?;
        let mut rows = stmt.query_map([], |r| {
            Ok(Session {
                id: r.get(0)?,
                started_at: r.get(1)?,
                ended_at: r.get(2)?,
                summary: r.get(3)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }
}

// --- Data types -----------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct Event {
    pub id: i64,
    pub session_id: Option<i64>,
    pub ts: String,
    pub kind: String,
    pub actor: Option<String>,
    pub ref_type: Option<String>,
    pub ref_id: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct UseCase {
    pub id: String,
    pub title: String,
    pub actor: Option<String>,
    pub preconditions: Option<String>,
    pub main_flow: Option<String>,
    pub alt_flow: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TestCase {
    pub id: String,
    pub use_case_id: Option<String>,
    pub title: String,
    pub steps: Option<String>,
    pub expected: Option<String>,
    pub status: String,
    pub last_run_at: Option<String>,
    pub last_result: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct Session {
    pub id: i64,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub summary: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct UcLite {
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct UcShort {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TcLite {
    pub id: String,
    pub title: String,
    pub use_case_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct FailingTc {
    pub id: String,
    pub title: String,
    pub use_case_id: Option<String>,
    pub last_run_at: Option<String>,
    pub fail_count: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct RecurringFail {
    pub id: String,
    pub title: String,
    pub fail_count: i64,
}

#[derive(Debug, Serialize)]
pub struct Health {
    pub stale_ucs: Vec<UcLite>,
    pub failing_tcs: Vec<FailingTc>,
    pub untested_tcs: Vec<TcLite>,
    pub untested_ucs: Vec<UcShort>,
    pub recurring_fails: Vec<RecurringFail>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct InboxByPriority {
    pub urgent: i64,
    pub high: i64,
    pub normal: i64,
    pub low: i64,
}

#[derive(Debug, Serialize)]
pub struct InboxDigest {
    pub unread_count: i64,
    pub by_priority: InboxByPriority,
    pub top_unread: Vec<InboxRow>,
    pub recent_resolved: Vec<InboxRow>,
}

#[derive(Debug, Serialize)]
pub struct ContextBrief {
    pub summary: String,
    pub active_ucs: Vec<UseCase>,
    pub health_warnings: Vec<String>,
    pub failing_tests: Vec<FailingTc>,
    pub untested_tcs: Vec<TcLite>,
    pub recent_decisions: Vec<Event>,
    pub last_session: Option<Session>,
    pub inbox: InboxDigest,
}

#[derive(Debug, Serialize, Clone)]
pub struct NextTcFull {
    pub id: String,
    pub title: String,
    pub use_case_id: Option<String>,
    pub last_run_at: Option<String>,
    pub uc_title: String,
    pub main_flow: Option<String>,
    pub steps: Option<String>,
    pub expected: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct InboxRow {
    pub id: i64,
    pub ts: String,
    pub sender_project: String,
    pub recipient_project: String,
    pub kind: String,
    pub priority: String,
    pub ref_type: Option<String>,
    pub ref_id: Option<String>,
    pub content: Option<String>,
    pub status: String,
    pub resolved_ts: Option<String>,
    pub resolved_by: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MissingTcUc {
    pub id: String,
    pub title: String,
    pub main_flow: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum NextTask {
    #[serde(rename = "failing_test")]
    FailingTest {
        tc: NextTcFull,
        reason: String,
        next_action: String,
    },
    #[serde(rename = "untested_tc")]
    UntestedTc {
        tc: NextTcFull,
        reason: String,
        next_action: String,
    },
    #[serde(rename = "missing_tc")]
    MissingTc {
        uc: MissingTcUc,
        reason: String,
        next_action: String,
    },
    #[serde(rename = "all_clear")]
    AllClear { message: String },
}
