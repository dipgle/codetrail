# Codetrail

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-codetrail.dipgle.com-6ee7b7?logo=icloud)](https://codetrail.dipgle.com/)
[![Status](https://img.shields.io/badge/status-open%20beta-blue)](https://codetrail.dipgle.com/#waitlist)
[![Stack](https://img.shields.io/badge/stack-Rust%20%2B%20JS%20%2B%20sql.js-orange)](#)

> **Persistent memory for AI coding sessions.** Auto-logging devlog, UC/TC tracking, stale-resume warnings. Stop losing context between Claude Code sessions.

🌐 **Live**: https://codetrail.dipgle.com/
🔍 **Viewer**: https://codetrail.dipgle.com/viewer.html?demo=1

---

## Why

Every Claude Code session is fresh — no memory of what happened yesterday, last week, on the other 5 projects you're juggling. You write notes in `memory/active-context.md`, but they decay fast. The next session reads stale narrative + confidently tells you the wrong story.

Codetrail fixes this mechanically:

1. **Every file edit auto-logs** to `logs/devlog.sqlite` via PostToolUse hook. Zero `log_event` calls to remember.
2. **Session resume warns** when devlog is stale vs file mtime — you see the gap directly in the prompt, can't miss it.
3. **Structured tracking** of use cases, test cases, test runs — TDD-aligned, not vibes-aligned.
4. **Browser viewer** drag-drop any `devlog.sqlite` → events / UCs / TCs / runs render instantly. Pure WASM, data never leaves browser.
5. **Multi-project memory** — Codetrail walks up from any file to find the right devlog. One brain across all your codebases.

## Install

```bash
# One-line setup
curl -fsSL https://codetrail.dipgle.com/install.txt | bash

# Then for any new project:
np my-app          # scaffolds + opens Claude Code

# Or adopt an existing project:
cd /path/to/repo
adopt
```

## Comparison

| Feature | Codetrail | Claude Code | Aider | Cursor |
|---|:---:|:---:|:---:|:---:|
| Structured project devlog | ✓ | — | git only | — |
| UC / TC + test_runs tracked | ✓ | — | — | — |
| Multi-project memory | ✓ | partial | per-repo | per-session |
| Auto-log without code calls | ✓ | discipline | inherent | — |
| Browser-native viewer | ✓ | — | terminal | — |
| Stale-resume warning | ✓ | — | — | — |
| Local-first | ✓ | hybrid | ✓ | cloud |
| Setup time | ~30s | ~5min | ~1min | ~10min |

## Pricing

Pricing for cloud sync (Pro / Team tiers) has not been finalized; nothing is committed yet. The free tier (everything in this repo + the OSS hooks) will stay free regardless. Drop your email on the waitlist to be notified when paid tiers open.

## Status

🟡 **Open alpha** as of 2026-06-02. What ships today:

- ✅ Landing + viewer at https://codetrail.dipgle.com/
- ✅ OSS scaffolder, hooks, and SQLite devlog schema (this repo)
- ⏳ MCP server binary (`project-agent`) is closed source; a hosted binary download is **on the roadmap** — not yet available
- ⏳ Cloud sync, dashboard, multi-project search — planned

Until the MCP binary ships, the scaffolder + hooks still work standalone; query the devlog directly with `sqlite3 logs/devlog.sqlite`.

## What's open source

This repo contains:

- 🛠️ `template/` — the project scaffolder (CLAUDE.md, sqlite schema seeder)
- 🪝 `hooks/` — auto-artifact log + stale-resume-check hooks for Claude Code
- 🌐 `landing/` — the static site you see at codetrail.dipgle.com (+ deploy.mjs)

The MCP server binary (`project-agent`) stays closed source. A hosted binary download is on the roadmap.

## License

MIT for everything in this repo. Binary download has its own EULA (free Beta usage allowed).

## Contact

- Twitter: TBD
- Email: trace.codetrail@gmail.com
- Issues: this repo
