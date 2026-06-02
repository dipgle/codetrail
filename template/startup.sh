#!/usr/bin/env bash
# Bootstrap a new project from this template.
#
# Usage:
#   ./startup.sh                 # initialize in current dir
#   ./startup.sh /path/to/new    # initialize in target dir (created if missing)
#
# The MCP server code stays in this template's /mcp folder (single source of
# truth). Each project gets its own memory + logs by passing PROJECT_MEMORY_DIR
# and PROJECT_LOG_DIR to the MCP server via `claude mcp add -e`.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/mcp"
TEMPLATE_CLAUDE_MD="$SCRIPT_DIR/CLAUDE.md"
TEMPLATE_DOCS_DIR="$SCRIPT_DIR/docs"

TARGET="${1:-$(pwd)}"
mkdir -p "$TARGET"
cd "$TARGET"
PROJECT_DIR="$(pwd)"

echo "Initializing project: $PROJECT_DIR"
echo "Shared MCP:           $MCP_DIR"

# 1. Scaffold project knowledge structure
mkdir -p docs memory logs

[ -f CLAUDE.md ] || cp "$TEMPLATE_CLAUDE_MD" CLAUDE.md
[ -f PLAN.md ]   || touch PLAN.md
[ -f TODO.md ]   || touch TODO.md

# Doc skeleton — copy templates if the template ships content, else create empty.
for f in architecture.md conventions.md testing-knowledge.md decision-log.md \
         use-cases.md test-cases.md kickoff.md; do
    if [ ! -f "docs/$f" ]; then
        if [ -f "$TEMPLATE_DOCS_DIR/$f" ]; then
            cp "$TEMPLATE_DOCS_DIR/$f" "docs/$f"
        else
            touch "docs/$f"
        fi
    fi
done

for f in active-context.md session-summary.md discovered-knowledge.md; do
    [ -f "memory/$f" ] || touch "memory/$f"
done

# 2. Initialize devlog sqlite (idempotent — schema is also created on first MCP write).
DEVLOG="$PROJECT_DIR/logs/devlog.sqlite"
if [ ! -f "$DEVLOG" ]; then
    if command -v sqlite3 >/dev/null 2>&1; then
        echo "Seeding devlog schema: $DEVLOG"
        sqlite3 "$DEVLOG" <<'SQL'
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
SQL
    else
        echo "sqlite3 CLI not found; MCP server will create schema on first write."
    fi
fi

# .gitignore: keep the sqlite WAL/SHM out of git but keep the DB itself.
if [ -f .gitignore ] && ! grep -q "logs/devlog.sqlite-" .gitignore; then
    {
        echo ""
        echo "# devlog sqlite sidecars"
        echo "logs/devlog.sqlite-wal"
        echo "logs/devlog.sqlite-shm"
    } >> .gitignore
fi

# 3. Ensure Rust binary built (idempotent, ~50s one-time)
BINARY="$MCP_DIR/project-agent-rs/target/release/project-agent"
if [ ! -x "$BINARY" ]; then
    echo "Building project-agent Rust binary (one-time, ~50s)..."
    (cd "$MCP_DIR/project-agent-rs" && cargo build --release) || {
        echo "ERROR: cargo build failed. Install Rust: https://rustup.rs"
        exit 1
    }
fi

# 4. Register MCP at project scope (writes .mcp.json in project root).
#    PROJECT_MEMORY_DIR + PROJECT_LOG_DIR isolate this project's state.

claude mcp add project-agent \
    -s project \
    -e PROJECT_MEMORY_DIR="$PROJECT_DIR/memory" \
    -e PROJECT_LOG_DIR="$PROJECT_DIR/logs" \
    -- "$BINARY"

echo ""
echo "✅ Project scaffolded at: $PROJECT_DIR"
echo "   Memory dir: $PROJECT_DIR/memory"
echo "   Log dir:    $PROJECT_DIR/logs (devlog.sqlite)"
echo "   MCP config: $PROJECT_DIR/.mcp.json"
echo ""
echo "▶ Next step — open Claude in the new project to start discovery dialog:"
echo ""
echo "    cd \"$PROJECT_DIR\" && claude"
echo ""
