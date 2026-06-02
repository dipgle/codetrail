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

- **Free** — solo dev, local-only, all features
- **Pro $9/mo** — cloud sync, cross-project search, web dashboard
- **Team $29/user/mo** — multi-user, SSO, audit log

14-day no-card trial on paid. Annual -20%. Education / OSS: Pro free.

## Status

🟢 **Live in open beta** as of 2026-06-02. Currently building waitlist for cloud sync (Pro tier). Drop your email at https://codetrail.dipgle.com/#waitlist.

## What's open source

This repo will contain:

- 🛠️ `template/` — the project scaffolder (CLAUDE.md, docs/, memory/, devlog schema)
- 🪝 `hooks/` — auto-artifact log + stale-resume-check hooks for Claude Code
- 🌐 `landing/` — the static site you see at codetrail.dipgle.com
- 🔍 `viewer/` — the sql.js-based browser viewer

The **MCP server binary** (`project-agent`) is closed source. Free tier always available as a hosted binary download.

## License

MIT for everything in this repo. Binary download has its own EULA (free Beta usage allowed).

## Contact

- Twitter: TBD
- Email: trace.codetrail@gmail.com
- Issues: this repo
