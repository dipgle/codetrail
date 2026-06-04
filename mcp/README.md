# MCP server — two implementations

Both servers expose the same 14 tools (same JSON-RPC contract, same SQLite
schema). Pick whichever your environment supports. They can be swapped at any
time by editing the project's `.mcp.json`.

## Which one runs

`template/startup.sh` auto-detects:

1. If Node 20+ is installed → uses `project-agent-node/` (default).
2. Else if a Rust toolchain is installed → uses `project-agent-rs/`.
3. Else: scaffold + hooks still work; query the devlog with `sqlite3` directly.

Override the auto-pick with `CODETRAIL_MCP=node` or `CODETRAIL_MCP=rust` in
your environment before running `np` / `adopt`.

## project-agent-node/ — TypeScript

| | |
|---|---|
| Stack | TypeScript on Node 20+, `@modelcontextprotocol/sdk`, `better-sqlite3` |
| Build | `cd mcp/project-agent-node && npm install && npx tsc` (~10s, prebuilt sqlite) |
| Bundle | ~50 KB JS + native sqlite binding (npm ships prebuilds for all major OS/arch) |
| Runs on | Windows x64/arm64, macOS x64/arm64, Linux x64/arm64 (glibc + musl) |
| Smoke | `node scripts/smoke.mjs` — checks initialize + tools/list + log+read round-trip |

Recommended for everyone except users who specifically want native speed.

## project-agent-rs/ — Rust

| | |
|---|---|
| Stack | Rust + `rmcp` + `rusqlite` (bundled SQLite) |
| Build | `cd mcp/project-agent-rs && cargo build --release` (~50s first time) |
| Binary | Single static binary, ~3 MB stripped |
| Why pick | Lower startup latency, lower idle memory, easier to embed in further tools |
| Cross-compile | `cargo zigbuild --target x86_64-unknown-linux-musl` etc. |

Recommended if you're already on the Rust train, want to hack on the server,
or need to redistribute a single-file binary.

## Same tool surface

Both implementations export these tools:

- `log_event` — append to events table
- `create_use_case`, `create_test_case`, `record_test_run`
- `list_use_cases`, `list_test_cases`, `recent_events`
- `scan_health`, `get_context_brief`, `next_task`
- `list_projects` (router mode only)
- `save_memory`, `add_knowledge`, `search_knowledge` (workspace mode only)

Two operating modes:

- **Workspace mode** — `PROJECT_LOG_DIR` / `PROJECT_MEMORY_DIR` env set; one
  project per process. This is what `np` / `adopt` register.
- **Router mode** — `PROJECTS_ROOT` env set; tools require a `project`
  parameter. Used when you want a single MCP serving many adopted projects.

## License

MIT, both implementations.
