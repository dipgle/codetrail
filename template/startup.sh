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
#
# Two MCP implementations ship in this repo:
#   - mcp/project-agent-node/ (default, cross-platform, requires Node 20+)
#   - mcp/project-agent-rs/   (optional, faster, requires Rust toolchain)
# Node is preferred when present. Override with CODETRAIL_MCP=rust.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_DIR="$REPO_ROOT/mcp"
TEMPLATE_CLAUDE_MD="$SCRIPT_DIR/CLAUDE.md"
TEMPLATE_DOCS_DIR="$SCRIPT_DIR/docs"

TARGET="${1:-$(pwd)}"
mkdir -p "$TARGET"
cd "$TARGET"
PROJECT_DIR="$(pwd)"

echo "Initializing project: $PROJECT_DIR"
echo "Shared MCP root:      $MCP_DIR"

# 1. Scaffold project knowledge structure
mkdir -p docs memory logs

[ -f CLAUDE.md ] || cp "$TEMPLATE_CLAUDE_MD" CLAUDE.md
[ -f PLAN.md ]   || touch PLAN.md
[ -f TODO.md ]   || touch TODO.md

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

# Scaffold runner.sh — file-based command runner for sandbox/CI escape hatch.
# The daemon is opt-in (user must run `bash runner.sh` to start watching).
# Allowlist ships empty; user edits the script to add their commands.
if [ ! -f runner.sh ] && [ -f "$SCRIPT_DIR/runner.sh" ]; then
    cp "$SCRIPT_DIR/runner.sh" runner.sh
    chmod +x runner.sh
fi
mkdir -p .cmd-queue .cmd-results

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
SQL
    else
        echo "sqlite3 CLI not found; MCP server will create schema on first write."
    fi
fi

if [ -f .gitignore ] && ! grep -q "logs/devlog.sqlite-" .gitignore; then
    {
        echo ""
        echo "# devlog sqlite sidecars"
        echo "logs/devlog.sqlite-wal"
        echo "logs/devlog.sqlite-shm"
    } >> .gitignore
fi

# 3. MCP registration — prefer Node, fall back to Rust.
MCP_REGISTERED=0
MCP_NODE_DIR="$MCP_DIR/project-agent-node"
MCP_NODE_DIST="$MCP_NODE_DIR/dist/server.js"
MCP_RUST_BIN="$MCP_DIR/project-agent-rs/target/release/project-agent"

# Derive PROJECTS_ROOT + project name for cross-project inbox.
# Convention: <root>/AI/<project>/ → PROJECTS_ROOT=<root>, project=<project>.
# Fallback: dirname(PROJECT_DIR) as root, basename(PROJECT_DIR) as project.
PROJECT_NAME="$(basename "$PROJECT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_DIR")"
if [ "$(basename "$PARENT_DIR")" = "AI" ]; then
    PROJECTS_ROOT_GUESS="$(dirname "$PARENT_DIR")"
else
    PROJECTS_ROOT_GUESS="$PARENT_DIR"
fi

choose_mcp() {
    case "${CODETRAIL_MCP:-}" in
        node) echo node; return ;;
        rust) echo rust; return ;;
    esac
    if [ -d "$MCP_NODE_DIR" ] && command -v node >/dev/null 2>&1; then
        echo node
    elif [ -d "$MCP_DIR/project-agent-rs" ] && command -v cargo >/dev/null 2>&1; then
        echo rust
    else
        echo none
    fi
}

build_node() {
    echo "Building Node MCP server (one-time, ~10s with prebuilt sqlite)..."
    (cd "$MCP_NODE_DIR" && npm install --silent && npx tsc) >/dev/null 2>&1
}

build_rust() {
    echo "Building project-agent Rust binary (one-time, ~50s)..."
    (cd "$MCP_DIR/project-agent-rs" && cargo build --release --quiet) >/dev/null 2>&1
}

register_node() {
    [ -f "$MCP_NODE_DIST" ] || build_node || return 1
    command -v claude >/dev/null 2>&1 || return 1
    claude mcp add project-agent \
        -s project \
        -e PROJECT_MEMORY_DIR="$PROJECT_DIR/memory" \
        -e PROJECT_LOG_DIR="$PROJECT_DIR/logs" \
        -e PROJECTS_ROOT="$PROJECTS_ROOT_GUESS" \
        -e CODETRAIL_PROJECT="$PROJECT_NAME" \
        -- node "$MCP_NODE_DIST" && MCP_REGISTERED=1
}

register_rust() {
    [ -x "$MCP_RUST_BIN" ] || build_rust || return 1
    command -v claude >/dev/null 2>&1 || return 1
    claude mcp add project-agent \
        -s project \
        -e PROJECT_MEMORY_DIR="$PROJECT_DIR/memory" \
        -e PROJECT_LOG_DIR="$PROJECT_DIR/logs" \
        -e PROJECTS_ROOT="$PROJECTS_ROOT_GUESS" \
        -e CODETRAIL_PROJECT="$PROJECT_NAME" \
        -- "$MCP_RUST_BIN" && MCP_REGISTERED=1
}

case "$(choose_mcp)" in
    node) register_node || true ;;
    rust) register_rust || true ;;
    none) echo "WARN: no MCP implementation available. Install Node 20+ or Rust." ;;
esac

echo ""
echo "✅ Project scaffolded at: $PROJECT_DIR"
echo "   Memory dir: $PROJECT_DIR/memory"
echo "   Log dir:    $PROJECT_DIR/logs (devlog.sqlite)"
if [ "$MCP_REGISTERED" -eq 1 ]; then
    echo "   MCP config: $PROJECT_DIR/.mcp.json"
else
    echo ""
    echo "ℹ  MCP server not registered. Hooks + sqlite still work standalone;"
    echo "   query devlog with: sqlite3 \"$PROJECT_DIR/logs/devlog.sqlite\""
fi
echo ""
echo "▶ Next step — open Claude in the new project to start discovery dialog:"
echo ""
echo "    cd \"$PROJECT_DIR\" && claude"
echo ""
