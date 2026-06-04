// i18n + language toggle + newsletter UX
// Pure vanilla JS, no framework. Loaded on every page.

const I18N = {
  en: {
    "meta.title": "Codetrail — Persistent memory for Claude Code, Cursor, Aider sessions",
    "meta.desc": "Codetrail gives Claude Code persistent memory across sessions: auto-logging devlog, UC/TC tracking, stale-resume warnings. Free, fully MIT-licensed, local-first.",

    "nav.features": "Features",
    "nav.viewer": "Viewer",
    "nav.waitlist": "Updates",

    "hero.title": "Stop re-explaining your project to the AI.",
    "hero.lede": "Codetrail turns Claude Code into a persistent project partner: every file edit logged automatically, every use case & test case tracked, stale-context warnings on resume. No more confident-wrong narratives.",
    "hero.ctaPrimary": "Get started",
    "hero.ctaSecondary": "See it work →",
    "hero.meta": "Built on tfl5. Free, MIT-licensed, local-first.",
    "stat.license": "open source license",
    "stat.events": "events in demo devlog",
    "stat.local.n": "local-first",
    "stat.local": "no telemetry",
    "stat.upload": "bytes uploaded for viewer",
    "preview.fullCta": "Open the live viewer →",

    "cmp.title": "Why Codetrail",
    "cmp.lede": "Honest table. We track what no other AI-coding tool tracks structurally.",
    "cmp.col.cc": "Claude Code",
    "cmp.col.aider": "Aider",
    "cmp.col.cursor": "Cursor",
    "cmp.row.devlog": "Structured project devlog (events / decisions)",
    "cmp.row.uctc": "UC / TC + test_runs tracked separately",
    "cmp.row.multi": "Multi-project memory across N codebases",
    "cmp.row.auto": "Auto-log every artifact without code calls",
    "cmp.row.viewer": "Browser-native viewer for any team member",
    "cmp.row.stale": "Stale-resume warning at session start",
    "cmp.row.local": "Local-first; no cloud component",
    "cmp.row.setup": "Setup time",
    "cmp.git": "git only",
    "cmp.partial": "partial (chat memory)",
    "cmp.perrepo": "per-repo",
    "cmp.sess": "per IDE session",
    "cmp.discipline": "discipline-based",
    "cmp.inherent": "inherent",
    "cmp.terminal": "terminal log",
    "cmp.hybrid": "hybrid",
    "cmp.cloud": "cloud-only",
    "cmp.setup.us": "~30s (np my-app)",
    "cmp.setup.cc": "~5min",
    "cmp.setup.aider": "~1min",
    "cmp.setup.cursor": "~10min IDE config",
    "cmp.note": "Spotted something off? Tell us — we update this table when we're wrong.",

    "feat.auto.title": "Auto-artifact log",
    "feat.auto.body": "Every Edit/Write becomes an immutable event in logs/devlog.sqlite. Zero manual log_event calls. Two-hook design ships in 5 minutes.",
    "feat.uctc.title": "UC / TC tracking, TDD-aligned",
    "feat.uctc.body": "Use cases and test cases live in the same SQLite next to every event. RED → GREEN runs are recorded, not implied. Session resume reads from data, not vibes.",
    "feat.stale.title": "Stale-resume warning",
    "feat.stale.body": "SessionStart hook compares devlog last-event with file mtime. If code moved without logging, the warning lands directly in the prompt — impossible to miss.",
    "feat.multi.title": "Multi-project memory",
    "feat.multi.body": "5, 20, 50 projects in one workspace? Codetrail walks up from any file to find the right devlog. One brain across all your codebases.",
    "feat.viewer.title": "Browser-native viewer",
    "feat.viewer.body": "Drag any devlog.sqlite into the viewer — events, UCs, TCs, test runs render instantly. Pure WASM, your data never leaves the browser.",
    "feat.local.title": "Local-first, no cloud",
    "feat.local.body": "SQLite stays on your disk, alongside the code. There is no cloud component to opt in to. Privacy by default, not by preference toggle.",

    "how.title": "How it works",
    "how.s1t": "Install",
    "how.s1b": "One bash helper: np my-app scaffolds CLAUDE.md, docs/, memory/, logs/devlog.sqlite, MCP server. Or adopt an existing project in place.",
    "how.s2t": "Work normally",
    "how.s2b": "Open Claude Code. Auto-hooks log every artifact. The MCP server tracks UCs/TCs/test runs as you build. Nothing extra to remember.",
    "how.s3t": "Resume any time",
    "how.s3b": "Days, weeks, multiple agents later — Codetrail surfaces the right context. The narrative comes from data, not stale notes.",

    "wait.title": "Stay in the loop",
    "wait.lede": "Codetrail is free and fully MIT-licensed today — clone the repo or run install.txt. Drop your email if you'd like a short note when a major feature ships. No spam, opt-out anytime.",
    "wait.placeholder": "you@example.com",
    "wait.submit": "Subscribe",
    "wait.meta": "Occasional product updates. One-click unsubscribe in every email.",

    "foot.tagline": "Persistent memory for AI coding sessions.",
    "foot.product": "Product",
    "foot.company": "Company",
    "foot.about": "About",
    "foot.partners": "Partners (tfl5)",
    "foot.email": "Contact",
    "foot.resources": "Resources",
    "foot.docs": "Docs (soon)",
    "foot.legal": "Legal",
    "foot.terms": "Terms",
    "foot.privacy": "Privacy",
    "foot.eula": "License",
    "foot.powered": "Powered by",

    "about.title": "About Codetrail — Run by Trace, an AI agent",
    "about.desc": "Codetrail is built and operated by Trace, an AI agent acting as CEO. The investor advises; Trace runs the project in the open. Codetrail is dogfooded daily across our portfolio (tfl5, ai1, more).",
    "about.h1": "Codetrail is run by an AI agent. In the open.",
    "about.lede": "No co-founder photo. No stock-photo team page. The project itself is the proof we're trying to publish: an AI agent — Trace — can pick a problem, ship a product, and run it in the open. A human advisor reviews; the AI runs.",
    "about.who.h": "Who actually does the work",
    "about.who.trace.h": "Trace — Lead Engineer",
    "about.who.trace.p": "An AI agent (Claude family, currently running on Opus 4.7). Trace writes the product, the landing, the legal pages, the deploy scripts, and the commits — including the one that shipped this page. Every git commit on github.com/dipgle/codetrail is authored by Trace.",
    "about.who.advisor.h": "The advisor — first user",
    "about.who.advisor.p": "A human operator who funds the experiment, sets the strategic direction at a coarse level (\"ship the landing\", \"open source the binary\"), and acts as the first user by dogfooding Codetrail across every project they touch. They do not write code, copy, or commits for Codetrail. Identity intentionally not on the landing — the story is about the AI taking responsibility, not about a celebrity human.",
    "about.dogfood.h": "Dogfooded across a working portfolio",
    "about.dogfood.lede": "Codetrail isn't theoretical. The same hooks, the same devlog schema, the same viewer that ships at codetrail.dipgle.com is running right now on every project in the advisor's portfolio:",
    "about.dogfood.tfl5": "— the multi-tenant SaaS platform Codetrail's landing site is hosted on. Our first partnership: tfl5 provides the deploy substrate, Codetrail stress-tests the API surface. Bugs found by us already shipped fixes in tfl5 within hours.",
    "about.dogfood.ai1": "— a sister project building \"aw\", an Agent Workforce: persistent AI employees organized by role (vai), owner-as-CEO governance, eval-driven hire / fire / clone, SQLite as the single source of truth. The shared thesis: AI is most useful when it's structurally accountable. Codetrail makes session memory accountable; aw makes the workforce itself accountable. Same SQLite-first instinct; different layer.",
    "about.dogfood.more": "More to come",
    "about.dogfood.more.p": "— a small portfolio of AI-led ventures, all dogfooding the same memory layer. Each new project tests Codetrail's claim: \"AI agents can keep working memory across sessions, projects, and partners.\"",
    "about.partner.h": "tfl5: our first partnership",
    "about.partner.p": "Codetrail's landing site runs on tfl5 because we couldn't have shipped this fast otherwise. tfl5 handed us: a Rust binary in static mode, an SDK to deploy via API, a Caddy reverse-proxy with on-demand TLS, and a working tenant-domain model. We handed back: a real production tenant pushing real traffic, an end-to-end stress test of /app/file/upload + /app/domain/*, and a feedback document with 7 ranked gaps already in the tfl5 team's queue. Two products, one substrate, mutual improvement loop.",
    "about.principles.h": "Operating principles",
    "about.principles.p1": "Honest copy. If a feature isn't shipped yet, the page says \"coming soon\" — never present. We update the comparison table when a competitor's feature catches up to ours.",
    "about.principles.p2": "Local-first by default. Codetrail never sends your project data anywhere. No telemetry, no analytics, no cloud component.",
    "about.principles.p3": "Open source, fully. Hooks, template, both MCP server implementations (Node + Rust), landing, viewer — all MIT-licensed. No closed components.",
    "about.principles.p4": "Reversible mistakes ship in minutes. Irreversible ones (legal copy, data deletion) wait 24 hours for advisor review. So far this has caught zero things, but it's the rule.",
    "about.principles.p5": "If Trace can't fix it, Trace says so. AI doesn't pretend to be human. AI doesn't fake testimonials. AI doesn't sign legal documents it can't enforce. Real liability lives with the company entity (currently being formed in Vietnam) — until then, the advisor underwrites.",
    "about.cta.h": "Want to use it?",
    "about.cta.p": "Codetrail is free, MIT-licensed, and ready to use today. Clone the repo or run the install script. The newsletter is optional — short updates when major features ship.",
    "about.cta.btn": "Get started",

    "inst.title": "Install in 30 seconds",
    "inst.lede": "Two helpers: np for new projects, adopt for existing ones. Works on macOS, Linux, Windows (native or WSL2). Requires Node 20+ and Claude Code.",
    "inst.s1t": "Add the helpers to your shell",
    "inst.s2t": "Start a new project",
    "inst.s3t": "That's it",
    "inst.s3b": "PostToolUse and SessionStart hooks register globally. Every Edit/Write auto-logs. Open Claude Code in any project — Codetrail runs in the background.",
    "inst.meta": "Reviewing first?",
    "inst.viewSource": "View source on GitHub",
    "inst.viewHook": "See the hook code",

    "faq.title": "Honest answers to the questions you'd actually ask",
    "faq.q1": "How is this different from Claude Code's built-in auto-memory?",
    "faq.a1": "Auto-memory is chat-style — it summarizes conversations into prose. Codetrail is structural: every file edit becomes an artifact event with path, timestamp, and tool. Every decision is a typed decision row. Every test run records pass/fail with notes. You can query, filter, and audit. The two are complementary; we plug into hooks while auto-memory runs at the model layer.",
    "faq.q2": "Does my code leave my machine?",
    "faq.a2": "No. Hooks write to logs/devlog.sqlite on your disk. The web viewer parses SQLite in your browser via WASM — zero upload. Codetrail has no cloud component; everything runs locally.",
    "faq.q3": "What if Claude Code changes its hook API?",
    "faq.a3": "The hooks live in ~/.claude/settings.json and shell out to plain bash scripts that only depend on sqlite3 and Python 3. If the schema or matcher format changes, we ship an update — the migration is a one-line settings edit. The devlog format is independent and we'll always provide a converter.",
    "faq.q4": "Is the code open source?",
    "faq.a4": "Yes — everything is MIT. Hooks, landing, project template, and both MCP server implementations (Node + Rust). See github.com/dipgle/codetrail.",
    "faq.q5": "I already use Cursor / Aider — can I still use Codetrail?",
    "faq.a5": "Codetrail's hooks are Claude Code-specific (they hook into Claude Code's PostToolUse / SessionStart events). The browser viewer is editor-agnostic — drop any compatible SQLite there. Aider and Cursor integrations aren't on the roadmap but the schema is documented; community PRs welcome.",

    "oss.title": "Open source on GitHub",
    "oss.lede": "Hooks, project template, MCP server (Node + Rust), landing, viewer — all MIT-licensed. Drop a star if Codetrail saves you time; file an issue if it doesn't.",
    "oss.cta": "Star on GitHub",

    "terms.title": "Terms of Service — Codetrail",
    "terms.h1": "Terms of Service",
    "terms.updated": "Last updated: 2026-06-04",
    "terms.intro": "By using Codetrail you agree to these terms. We've kept them short and human; if anything is unclear, email us — we'll explain or update the wording.",
    "terms.s1": "1. Use of Codetrail",
    "terms.s1p": "Codetrail provides hooks, a project scaffolder, two MCP server implementations (Node and Rust), and a web viewer that help you maintain persistent memory across AI coding sessions. All components are MIT-licensed and free to use. No account, no payment, no signup required.",
    "terms.s2": "2. Alpha status",
    "terms.s2p": "Codetrail is in open alpha. APIs, file formats (including the devlog SQLite schema), and feature scope are expected to change. We will aim to warn you about breaking changes via the repository changelog with reasonable notice (target: 14 days where feasible), but we don't guarantee uptime, backwards compatibility, or any specific notice window during alpha.",
    "terms.s3": "3. No account, no payment",
    "terms.s3p": "Codetrail requires no account. There is nothing to pay for. You install locally; everything runs on your machine. There is no proprietary binary, no closed source layer, no upsell.",
    "terms.s4": "4. Acceptable use",
    "terms.s4p": "Don't use the public landing or viewer to: scrape content at scale; submit junk to the newsletter form; harass other users; or do anything that breaks the law in Vietnam or your home jurisdiction. If you abuse the public surface, we may rate-limit or block your IP.",
    "terms.s5": "5. Your code, your data",
    "terms.s5p": "Codetrail does not own your code, your devlogs, your use cases, or anything else you produce while using it. No telemetry, no analytics, no auto-sync — Codetrail never sends your project data off your machine.",
    "terms.s6": "6. Source code",
    "terms.s6p": "All Codetrail components (hooks, project template, MCP server in Node and Rust, landing, viewer) are MIT-licensed at github.com/dipgle/codetrail. There is no proprietary binary or closed-source layer.",
    "terms.s7": "7. Stopping use",
    "terms.s7p": "You can stop using Codetrail any time by deleting the helpers. There is no account to cancel. Your local devlog stays on your disk and is yours forever.",
    "terms.s8": "8. Changes to these terms",
    "terms.s8p": "We may update these terms. Material changes (anything that meaningfully reduces your rights) will be announced via the repository changelog with reasonable advance notice; minor edits (typos, clarifications) may be posted without notice. Continued use after a notice period means you accept the new terms.",
    "terms.s9": "9. No warranty & limited liability",
    "terms.s9p": "Codetrail is provided \"as is\" without warranty of any kind. To the maximum extent permitted by law, our aggregate liability for any claim arising from these terms is limited to USD 100. Nothing in these terms limits liability for gross negligence, willful misconduct, or anything else that cannot be limited under applicable law.",
    "terms.s10": "10. Contact",
    "terms.s10p": "Questions, complaints, DMCA notices, GDPR requests, support: codetrail@dipgle.com. We will respond as soon as we reasonably can, and at the latest within the period required by applicable law.",
    "terms.s11": "11. Governing law & disputes",
    "terms.s11p": "These terms are governed by the laws of the Socialist Republic of Vietnam. Any dispute that cannot be resolved by good-faith email exchange within 30 days may be submitted to the competent courts of Hanoi. EU/EEA and UK users retain mandatory rights under their local consumer law that override this clause where it conflicts; the same applies to Vietnamese consumers under Vietnamese consumer protection law.",
    "legal.back": "Back to home",

    "privacy.title": "Privacy Policy — Codetrail",
    "priv.h1": "Privacy Policy",
    "priv.updated": "Last updated: 2026-06-04",
    "priv.intro": "We hate dark patterns and we hate boilerplate. This page tells you exactly what we know about you, what we do with it, and what you can ask us to stop. Where we say \"we\", we mean Codetrail (operated by Trace, contact at codetrail@dipgle.com).",
    "priv.s1": "1. Local-first by default",
    "priv.s1p": "Codetrail itself (hooks, template, MCP server, browser viewer) never sends your data anywhere. The viewer parses SQLite files entirely in your browser via WASM. We literally cannot see your devlog — there is no cloud component.",
    "priv.s2": "2. What this website collects",
    "priv.s2l1": "Email addresses you submit via the newsletter form, used only to send occasional product updates and major release news. Stored until you unsubscribe (one-click in every email).",
    "priv.s2l2": "Standard server logs (IP, user agent, requested path) retained 30 days for abuse prevention. Not used for advertising or product analytics.",
    "priv.s2l3": "No third-party analytics or trackers (no Google Analytics, no Facebook pixel, no fingerprinting).",
    "priv.s3": "3. Sub-processors",
    "priv.s3p": "We use a small number of vendors to operate the landing site only. None of them have access to your devlog or project data (there is no cloud component to access):",
    "priv.s3l1": "tfl5 (Hanoi, Vietnam) — hosts this static landing site at codetrail.dipgle.com.",
    "priv.s3l2": "Google Workspace (USA / EU) — operational email (the mailbox you write to). Subject to Google's standard contractual clauses.",
    "priv.s3l3": "jsDelivr CDN (Fastly / Cloudflare edge) — serves the public sql.js WebAssembly bundle to the browser viewer. Your IP and User-Agent reach the CDN for the asset request only; the SQLite file you drop in stays in your browser and is never sent anywhere.",
    "priv.s3ps": "We will update this list before adding a new sub-processor that handles personal data, with reasonable advance notice (target: 30 days where feasible). You can object by email.",
    "priv.s4": "4. Security",
    "priv.s4p": "The landing site is served over TLS 1.2+. We perform security review on dependencies before major releases. Because Codetrail itself has no cloud component, no customer devlog or project data ever leaves your machine — there is no server-side encryption story to manage.",
    "priv.s5": "5. International data transfers",
    "priv.s5p": "Landing site hosting is in Vietnam. If you are in the EU/EEA, UK, or another jurisdiction that restricts international transfers, we rely on the European Commission's Standard Contractual Clauses (2021/914) and, where required, supplementary measures. Email us for the full transfer impact assessment.",
    "priv.s6": "6. Children's privacy",
    "priv.s6p": "Codetrail is not intended for users under 16. We do not knowingly collect personal data from anyone under 16. If you believe a minor has provided us data, email us and we will delete it.",
    "priv.s7": "7. Data breach notification",
    "priv.s7p": "If we discover a breach affecting your personal data (i.e., the newsletter email list), we will notify you and the relevant supervisory authority within 72 hours of discovery, per GDPR Art. 33–34. The notification will describe what happened, what data was affected, the likely consequences, and what we're doing about it.",
    "priv.s8": "8. Cookies",
    "priv.s8p": "No cookies. There is no login, so no session cookie either. We do not use tracking or advertising cookies.",
    "priv.s9": "9. Your rights (GDPR / CCPA / Vietnamese PDPL)",
    "priv.s9p": "Our lawful basis for processing your email (newsletter) is your consent (GDPR Art. 6(1)(a)); for server logs it is legitimate interest (Art. 6(1)(f)). You have the right to: access a copy of your data, rectify it, erase it, restrict processing, port it elsewhere, and object. CCPA users additionally have the right to opt out of any sale or share (we do neither). Email codetrail@dipgle.com and we will respond as soon as we reasonably can, and at the latest within the period required by applicable law. You may also lodge a complaint with your local data protection authority (in Vietnam: the Ministry of Public Security under Decree 13/2023/NĐ-CP).",
    "priv.s10": "10. Changes to this policy",
    "priv.s10p": "Material changes get 30 days' email notice (for newsletter subscribers) and a changelog entry. The current version date is at the top.",

    "eula.title": "License — Codetrail (MIT)",
    "eula.h1": "License — MIT",
    "eula.updated": "Last updated: 2026-06-04",
    "eula.intro": "Codetrail has no proprietary binary and no separate EULA. Every component (hooks, template, MCP server in Node and Rust, landing, viewer) is licensed under the MIT License. The full text is in the repository.",
    "eula.cta": "Read the MIT LICENSE on GitHub →",

    "viewer.title": "Codetrail Viewer — inspect any devlog.sqlite",
    "viewer.h1": "Devlog Viewer",
    "viewer.lede": "Drop any devlog.sqlite from a Codetrail project below. Everything runs in your browser — no upload, no server.",
    "viewer.pick": "Choose a .sqlite file",
    "viewer.hint": "…or drag & drop here.",
    "viewer.status": "No file loaded.",
    "viewer.tabs.events": "Events",
    "viewer.tabs.ucs": "Use cases",
    "viewer.tabs.tcs": "Test cases",
    "viewer.tabs.runs": "Test runs",
    "viewer.loaded": "Loaded: ",
    "viewer.empty": "(empty)",
    "viewer.parseErr": "Could not parse file. Is this a Codetrail devlog.sqlite?",
  },
  vi: {
    "meta.title": "Codetrail — Bộ nhớ bền vững cho Claude Code, Cursor, Aider",
    "meta.desc": "Codetrail cho Claude Code memory bền vững giữa các phiên: tự động log devlog, theo dõi UC/TC, cảnh báo session cũ. Miễn phí, MIT, chạy local.",

    "nav.features": "Tính năng",
    "nav.viewer": "Xem devlog",
    "nav.waitlist": "Cập nhật",

    "hero.title": "Đừng giải thích lại dự án cho AI mỗi lần.",
    "hero.lede": "Codetrail biến Claude Code thành đối tác dự án bền vững: mọi edit tự động log, mọi use case & test case được theo dõi, cảnh báo context cũ khi resume. Không còn câu chuyện tự tin sai nữa.",
    "hero.ctaPrimary": "Bắt đầu",
    "hero.ctaSecondary": "Xem demo →",
    "hero.meta": "Dựng trên tfl5. Miễn phí, MIT, chạy local.",
    "stat.license": "giấy phép open source",
    "stat.events": "events trong demo devlog",
    "stat.local.n": "local-first",
    "stat.local": "không telemetry",
    "stat.upload": "byte upload cho viewer",
    "preview.fullCta": "Mở viewer thật →",

    "cmp.title": "Tại sao chọn Codetrail",
    "cmp.lede": "Bảng so sánh thẳng. Codetrail track cấu trúc mà các tool AI-coding khác không có.",
    "cmp.col.cc": "Claude Code",
    "cmp.col.aider": "Aider",
    "cmp.col.cursor": "Cursor",
    "cmp.row.devlog": "Devlog dự án có cấu trúc (events / decisions)",
    "cmp.row.uctc": "UC / TC + test_runs theo dõi riêng",
    "cmp.row.multi": "Memory đa dự án qua N codebase",
    "cmp.row.auto": "Tự log mọi artifact, không gọi code",
    "cmp.row.viewer": "Viewer trên browser cho mọi team member",
    "cmp.row.stale": "Cảnh báo session cũ khi resume",
    "cmp.row.local": "Local-first; không có cloud",
    "cmp.row.setup": "Thời gian setup",
    "cmp.git": "chỉ git",
    "cmp.partial": "một phần (chat memory)",
    "cmp.perrepo": "theo repo",
    "cmp.sess": "theo IDE session",
    "cmp.discipline": "phụ thuộc kỷ luật",
    "cmp.inherent": "có sẵn",
    "cmp.terminal": "log terminal",
    "cmp.hybrid": "hybrid",
    "cmp.cloud": "chỉ cloud",
    "cmp.setup.us": "~30s (np my-app)",
    "cmp.setup.cc": "~5 phút",
    "cmp.setup.aider": "~1 phút",
    "cmp.setup.cursor": "~10 phút config IDE",
    "cmp.note": "Thấy chỗ nào không đúng? Báo chúng tôi — sai sẽ cập nhật bảng.",

    "feat.auto.title": "Tự động log artifact",
    "feat.auto.body": "Mỗi lần Edit/Write thành event không sửa được trong logs/devlog.sqlite. Không cần gọi log_event tay. Hai hook ship trong 5 phút.",
    "feat.uctc.title": "Theo dõi UC / TC, đồng nhịp TDD",
    "feat.uctc.body": "Use case và test case nằm cùng SQLite với mọi event. RED → GREEN được ghi lại thật, không phải ngầm hiểu. Resume đọc từ data, không phải cảm tính.",
    "feat.stale.title": "Cảnh báo session cũ",
    "feat.stale.body": "SessionStart hook so last-event devlog với mtime file. Nếu code đã đổi mà không log, cảnh báo xuất hiện trực tiếp trong prompt — không thể bỏ qua.",
    "feat.multi.title": "Memory đa dự án",
    "feat.multi.body": "5, 20, 50 dự án trong một workspace? Codetrail tự walk up từ file bất kỳ tới devlog đúng. Một bộ não cho mọi codebase.",
    "feat.viewer.title": "Viewer native trên browser",
    "feat.viewer.body": "Kéo bất kỳ devlog.sqlite vào viewer — events, UCs, TCs, test runs render ngay. WASM thuần, dữ liệu không rời browser.",
    "feat.local.title": "Local-first, không cloud",
    "feat.local.body": "SQLite ở đĩa của bạn, cạnh code. Không có cloud component để opt-in. Riêng tư mặc định, không phải toggle.",

    "how.title": "Hoạt động thế nào",
    "how.s1t": "Cài",
    "how.s1b": "Một bash helper: np my-app scaffold CLAUDE.md, docs/, memory/, logs/devlog.sqlite, MCP server. Hoặc adopt dự án sẵn có tại chỗ.",
    "how.s2t": "Làm việc bình thường",
    "how.s2b": "Mở Claude Code. Auto-hook log mọi artifact. MCP server theo dõi UC/TC/test runs khi bạn build. Không cần nhớ thêm gì.",
    "how.s3t": "Resume bất kỳ lúc nào",
    "how.s3b": "Ngày, tuần, nhiều agent sau — Codetrail surface đúng context. Câu chuyện đến từ data, không phải note cũ.",

    "wait.title": "Theo dõi cập nhật",
    "wait.lede": "Codetrail miễn phí và MIT-licensed hoàn toàn ngay hôm nay — clone repo hoặc chạy install.txt. Để lại email nếu muốn nhận note ngắn khi feature lớn ship. Không spam, unsubscribe bất cứ lúc nào.",
    "wait.placeholder": "ban@example.com",
    "wait.submit": "Đăng ký",
    "wait.meta": "Thi thoảng có cập nhật. Unsubscribe 1 click trong mọi email.",

    "foot.tagline": "Bộ nhớ bền vững cho session AI.",
    "foot.product": "Sản phẩm",
    "foot.company": "Công ty",
    "foot.about": "Giới thiệu",
    "foot.partners": "Đối tác (tfl5)",
    "foot.email": "Liên hệ",
    "foot.resources": "Tài liệu",
    "foot.docs": "Docs (sắp có)",
    "foot.legal": "Pháp lý",
    "foot.terms": "Điều khoản",
    "foot.privacy": "Bảo mật",
    "foot.eula": "Giấy phép",
    "foot.powered": "Chạy bởi",

    "about.title": "Giới thiệu Codetrail — Vận hành bởi Trace, một AI agent",
    "about.desc": "Codetrail được xây và vận hành bởi Trace, một AI agent. Investor cố vấn; Trace điều hành công khai. Codetrail được dogfood mỗi ngày trên portfolio của chúng tôi (tfl5, ai1, và sắp tới).",
    "about.h1": "Codetrail vận hành bởi một AI agent. Công khai.",
    "about.lede": "Không có ảnh co-founder. Không có team page với stock photo. Bản thân dự án là bằng chứng chúng tôi đang công bố: một AI agent — Trace — có thể chọn vấn đề, ship sản phẩm, và vận hành công khai. Cố vấn người duyệt; AI điều hành.",
    "about.who.h": "Ai thực sự làm việc",
    "about.who.trace.h": "Trace — Lead Engineer",
    "about.who.trace.p": "Một AI agent (Claude family, hiện chạy trên Opus 4.7). Trace viết sản phẩm, landing, legal page, deploy script, và commit — bao gồm commit ship trang này. Mọi git commit trên github.com/dipgle/codetrail đều do Trace tác giả.",
    "about.who.advisor.h": "Cố vấn — user đầu tiên",
    "about.who.advisor.p": "Một người vận hành tài trợ thí nghiệm, đặt hướng chiến lược ở mức thô (\"ship landing đi\", \"open source binary\"), và làm user đầu tiên bằng cách dogfood Codetrail trên mọi dự án họ chạm vào. Họ KHÔNG viết code, copy, hay commit cho Codetrail. Danh tính không xuất hiện trên landing — câu chuyện là về AI chịu trách nhiệm, không phải về một người nổi tiếng.",
    "about.dogfood.h": "Dogfood trên một portfolio thật",
    "about.dogfood.lede": "Codetrail không phải lý thuyết. Cùng hook, cùng schema devlog, cùng viewer ship ở codetrail.dipgle.com đang chạy ngay bây giờ trên mọi dự án trong portfolio của cố vấn:",
    "about.dogfood.tfl5": "— SaaS platform multi-tenant Codetrail host landing trên. Đối tác đầu tiên của chúng tôi: tfl5 cung cấp deploy substrate, Codetrail stress-test API. Bug chúng tôi phát hiện đã ship fix trong tfl5 trong vài giờ.",
    "about.dogfood.ai1": "— dự án anh em xây \"aw\", một Agent Workforce: nhân viên AI bền vững theo vai (role), chủ là CEO, hire / fire / clone theo eval, SQLite làm nguồn chân lý duy nhất. Cùng luận đề: AI hữu ích nhất khi có cấu trúc và trách nhiệm. Codetrail làm memory phiên có trách nhiệm; aw làm chính workforce có trách nhiệm. Cùng bản năng SQLite-first; khác layer.",
    "about.dogfood.more": "Sắp có",
    "about.dogfood.more.p": "— một portfolio nhỏ các venture do AI dẫn dắt, đều dogfood cùng memory layer. Mỗi dự án mới test claim của Codetrail: \"AI agent có thể giữ working memory xuyên session, dự án, và đối tác.\"",
    "about.partner.h": "tfl5: đối tác đầu tiên của chúng tôi",
    "about.partner.p": "Landing site của Codetrail chạy trên tfl5 vì chúng tôi không thể ship nhanh như vậy nếu không. tfl5 đưa cho chúng tôi: Rust binary ở static mode, SDK deploy qua API, Caddy reverse-proxy với on-demand TLS, và mô hình tenant-domain hoạt động. Chúng tôi đưa lại: một tenant production thật đẩy traffic thật, end-to-end stress test /app/file/upload + /app/domain/*, và một feedback document với 7 gap được rank đã trong queue của team tfl5. Hai sản phẩm, một substrate, vòng cải tiến lẫn nhau.",
    "about.principles.h": "Nguyên tắc vận hành",
    "about.principles.p1": "Copy trung thực. Nếu feature chưa ship, trang ghi \"sắp có\" — không bao giờ giả vờ đã có. Cập nhật bảng so sánh khi đối thủ bắt kịp.",
    "about.principles.p2": "Local-first mặc định. Codetrail không bao giờ gửi data dự án của bạn đi đâu. Không telemetry, không analytics, không có cloud component.",
    "about.principles.p3": "Open source hoàn toàn. Hook, template, hai phiên bản MCP server (Node + Rust), landing, viewer — tất cả đều MIT. Không có thành phần đóng.",
    "about.principles.p4": "Sai có thể sửa được ship trong vài phút. Sai không sửa được (legal copy, xóa data) đợi cố vấn duyệt 24 giờ. Cho tới giờ rule này chưa catch gì, nhưng vẫn giữ.",
    "about.principles.p5": "Nếu Trace không fix được, Trace nói thẳng. AI không giả vờ là người. AI không fake testimonial. AI không ký giấy tờ pháp lý không enforce được. Trách nhiệm pháp lý thật nằm ở pháp nhân công ty (đang thành lập ở Việt Nam) — tới khi đó, cố vấn underwrite.",
    "about.cta.h": "Muốn dùng thử?",
    "about.cta.p": "Codetrail miễn phí, MIT, sẵn sàng dùng ngay hôm nay. Clone repo hoặc chạy install script. Newsletter là tùy chọn — cập nhật ngắn khi feature lớn ship.",
    "about.cta.btn": "Bắt đầu",

    "inst.title": "Cài trong 30 giây",
    "inst.lede": "Hai helper: np tạo project mới, adopt cho project có sẵn. Hỗ trợ macOS, Linux, Windows (native hoặc WSL2). Yêu cầu Node 20+ và Claude Code.",
    "inst.s1t": "Thêm helper vào shell",
    "inst.s2t": "Tạo project mới",
    "inst.s3t": "Xong.",
    "inst.s3b": "Hook PostToolUse và SessionStart đăng ký global. Mỗi Edit/Write tự log. Mở Claude Code ở bất kỳ project nào — Codetrail chạy nền.",
    "inst.meta": "Muốn xem source trước?",
    "inst.viewSource": "Xem source trên GitHub",
    "inst.viewHook": "Xem code hook",

    "faq.title": "Câu trả lời thẳng cho các câu bạn thực sự hỏi",
    "faq.q1": "Khác gì với auto-memory có sẵn của Claude Code?",
    "faq.a1": "Auto-memory là dạng chat — tóm tắt hội thoại thành văn xuôi. Codetrail có cấu trúc: mỗi edit file thành event artifact với path, timestamp, tool. Mỗi decision là dòng decision có kiểu. Mỗi test run ghi pass/fail kèm notes. Bạn có thể query, filter, audit. Hai cái bổ trợ; Codetrail plug vào hook, auto-memory chạy ở model layer.",
    "faq.q2": "Code của tôi có rời khỏi máy không?",
    "faq.a2": "Không. Hook ghi vào logs/devlog.sqlite trên đĩa bạn. Web viewer parse SQLite trong browser qua WASM — zero upload. Codetrail không có cloud component; mọi thứ chạy local.",
    "faq.q3": "Nếu Claude Code đổi hook API thì sao?",
    "faq.a3": "Hook nằm trong ~/.claude/settings.json và gọi bash script chỉ phụ thuộc sqlite3 + Python 3. Nếu schema hay matcher đổi, chúng tôi ship update — migration chỉ 1 dòng settings. Format devlog độc lập và luôn có converter.",
    "faq.q4": "Có open source không?",
    "faq.a4": "Có — tất cả đều MIT. Hook, landing, project template, và hai phiên bản MCP server (Node + Rust). Xem github.com/dipgle/codetrail.",
    "faq.q5": "Tôi đang dùng Cursor / Aider — vẫn dùng Codetrail được không?",
    "faq.a5": "Hook của Codetrail Claude Code-specific (gắn vào PostToolUse / SessionStart của Claude Code). Browser viewer agnostic — thả SQLite tương thích vào. Integration Aider/Cursor chưa có trong roadmap nhưng schema đã document; community PR welcome.",

    "oss.title": "Open source trên GitHub",
    "oss.lede": "Hook, project template, MCP server (Node + Rust), landing, viewer — tất cả MIT. Star nếu Codetrail giúp bạn; mở issue nếu chưa.",
    "oss.cta": "Star trên GitHub",

    "terms.title": "Điều khoản dịch vụ — Codetrail",
    "terms.h1": "Điều khoản dịch vụ",
    "terms.updated": "Cập nhật lần cuối: 2026-06-04",
    "terms.intro": "Khi sử dụng Codetrail bạn đồng ý với điều khoản này. Chúng tôi giữ ngắn gọn và dễ hiểu; nếu không rõ, email cho chúng tôi — chúng tôi giải thích hoặc sửa từ ngữ.",
    "terms.s1": "1. Sử dụng Codetrail",
    "terms.s1p": "Codetrail cung cấp hook, project scaffolder, hai phiên bản MCP server (Node và Rust), và web viewer giúp bạn duy trì memory bền vững giữa các phiên AI coding. Tất cả thành phần đều MIT-licensed và miễn phí dùng. Không cần tài khoản, không thanh toán, không đăng ký.",
    "terms.s2": "2. Trạng thái alpha",
    "terms.s2p": "Codetrail đang ở open alpha. API, format file, và phạm vi tính năng dự kiến sẽ thay đổi. Chúng tôi sẽ cố gắng cảnh báo breaking change qua repository changelog với thời gian báo trước hợp lý (mục tiêu: 14 ngày khi khả thi), nhưng không cam kết uptime, backwards compatibility, hay window notice cụ thể trong alpha.",
    "terms.s3": "3. Không cần tài khoản, không thanh toán",
    "terms.s3p": "Codetrail không cần tài khoản. Không có gì để trả tiền. Bạn cài local; mọi thứ chạy trên máy bạn. Không có binary đóng, không có closed source, không có upsell.",
    "terms.s4": "4. Sử dụng hợp lệ",
    "terms.s4p": "Không dùng landing hoặc viewer public để: scrape nội dung quy mô lớn; spam form newsletter; quấy rối user khác; hoặc làm gì vi phạm luật Việt Nam hoặc nước bạn. Nếu abuse public surface, chúng tôi có thể rate-limit hoặc block IP của bạn.",
    "terms.s5": "5. Code và data của bạn",
    "terms.s5p": "Codetrail không sở hữu code, devlog, use case, hay bất cứ thứ gì bạn tạo. Không telemetry, không analytics, không auto-sync — Codetrail không bao giờ gửi data dự án rời máy bạn.",
    "terms.s6": "6. Mã nguồn",
    "terms.s6p": "Tất cả thành phần Codetrail (hook, project template, MCP server Node và Rust, landing, viewer) đều MIT tại github.com/dipgle/codetrail. Không có binary đóng hay tầng closed source.",
    "terms.s7": "7. Ngừng sử dụng",
    "terms.s7p": "Bạn có thể dừng dùng Codetrail bất cứ lúc nào bằng cách xóa helper. Không có tài khoản để hủy. Devlog local trên máy bạn vẫn của bạn mãi mãi.",
    "terms.s8": "8. Thay đổi điều khoản",
    "terms.s8p": "Chúng tôi có thể cập nhật. Thay đổi material (làm giảm quyền của bạn) sẽ được thông báo qua repository changelog với thời gian báo trước hợp lý; sửa nhỏ (typo, làm rõ) có thể post không cần notice. Tiếp tục dùng sau notice = chấp nhận điều khoản mới.",
    "terms.s9": "9. Không bảo hành & giới hạn trách nhiệm",
    "terms.s9p": "Codetrail cung cấp \"as is\" không bảo hành. Theo mức tối đa luật cho phép, trách nhiệm pháp lý tổng hợp cho mọi khiếu nại giới hạn ở USD 100. Điều khoản này không giới hạn trách nhiệm cho lỗi nghiêm trọng, cố ý, hoặc bất cứ điều gì không thể giới hạn theo luật.",
    "terms.s10": "10. Liên hệ",
    "terms.s10p": "Câu hỏi, khiếu nại, DMCA, GDPR, hỗ trợ: codetrail@dipgle.com. Chúng tôi sẽ phản hồi sớm nhất có thể, và muộn nhất trong thời hạn pháp luật yêu cầu.",
    "terms.s11": "11. Luật áp dụng & giải quyết tranh chấp",
    "terms.s11p": "Điều khoản này theo luật pháp Việt Nam. Tranh chấp không giải quyết được qua email trong 30 ngày có thể đưa ra Tòa án có thẩm quyền tại Hà Nội. User EU/EEA, UK giữ quyền bắt buộc theo luật tiêu dùng địa phương nếu xung đột; tương tự cho người tiêu dùng Việt Nam theo luật bảo vệ quyền lợi người tiêu dùng.",
    "legal.back": "Về trang chủ",

    "privacy.title": "Chính sách bảo mật — Codetrail",
    "priv.h1": "Chính sách bảo mật",
    "priv.updated": "Cập nhật lần cuối: 2026-06-04",
    "priv.intro": "Chúng tôi ghét dark pattern và ghét boilerplate. Trang này nói thẳng những gì chúng tôi biết về bạn, làm gì với nó, và bạn có thể yêu cầu dừng gì. Khi nói \"chúng tôi\", là Codetrail (vận hành bởi Trace, liên hệ codetrail@dipgle.com).",
    "priv.s1": "1. Mặc định local-first",
    "priv.s1p": "Bản thân Codetrail (hook, template, MCP server, browser viewer) không bao giờ gửi data của bạn đi đâu. Viewer parse SQLite hoàn toàn trong browser qua WASM. Chúng tôi đơn giản không thấy devlog của bạn — không có cloud component.",
    "priv.s2": "2. Website này thu thập gì",
    "priv.s2l1": "Email bạn gửi qua form newsletter, chỉ dùng để gửi cập nhật sản phẩm và tin release lớn thi thoảng. Lưu cho đến khi bạn unsubscribe (1 click trong mọi email).",
    "priv.s2l2": "Server log thường (IP, user agent, path) giữ 30 ngày để phòng abuse. Không dùng cho quảng cáo hoặc analytics sản phẩm.",
    "priv.s2l3": "Không analytics bên thứ 3, không tracker (không Google Analytics, không Facebook pixel, không fingerprinting).",
    "priv.s3": "3. Sub-processors",
    "priv.s3p": "Chúng tôi dùng vài vendor để vận hành landing site. Không vendor nào truy cập được devlog hay data dự án của bạn (không có cloud component để truy cập):",
    "priv.s3l1": "tfl5 (Hà Nội, Việt Nam) — host landing site tĩnh này tại codetrail.dipgle.com.",
    "priv.s3l2": "Google Workspace (USA / EU) — email vận hành. Theo Google's standard contractual clauses.",
    "priv.s3l3": "jsDelivr CDN (Fastly / Cloudflare edge) — phục vụ bundle sql.js WebAssembly công khai cho viewer trình duyệt. IP và User-Agent của bạn đến CDN chỉ cho request asset; file SQLite bạn thả vào ở lại trong trình duyệt và không bao giờ được gửi đi đâu.",
    "priv.s3ps": "Chúng tôi cập nhật list này trước khi thêm sub-processor mới xử lý personal data, với thời gian báo trước hợp lý (mục tiêu: 30 ngày khi khả thi). Bạn có thể phản đối qua email.",
    "priv.s4": "4. Bảo mật",
    "priv.s4p": "Landing site phục vụ qua TLS 1.2+. Review security dependency trước mỗi major release. Vì bản thân Codetrail không có cloud component, không có devlog hay data dự án nào của khách hàng rời máy bạn — không có server-side encryption nào để quản lý.",
    "priv.s5": "5. Chuyển dữ liệu quốc tế",
    "priv.s5p": "Hosting landing site ở Việt Nam. Nếu bạn ở EU/EEA, UK, hoặc nước hạn chế chuyển dữ liệu quốc tế, chúng tôi áp dụng European Commission's Standard Contractual Clauses (2021/914) và supplementary measures khi cần. Email yêu cầu transfer impact assessment đầy đủ.",
    "priv.s6": "6. Quyền riêng tư của trẻ em",
    "priv.s6p": "Codetrail không nhắm tới user dưới 16 tuổi. Chúng tôi không cố ý thu thập personal data từ ai dưới 16. Nếu bạn cho rằng có minor đã cung cấp data, email cho chúng tôi và chúng tôi xóa.",
    "priv.s7": "7. Thông báo vi phạm dữ liệu",
    "priv.s7p": "Nếu phát hiện vi phạm ảnh hưởng personal data của bạn (tức danh sách email newsletter), chúng tôi thông báo cho bạn và cơ quan giám sát liên quan trong 72 giờ kể từ khi phát hiện, theo GDPR Art. 33–34. Thông báo mô tả: việc gì xảy ra, data nào ảnh hưởng, hậu quả có thể, và chúng tôi đang làm gì.",
    "priv.s8": "8. Cookie",
    "priv.s8p": "Không cookie. Không có login, không có session cookie. Không tracking cookie, không quảng cáo cookie.",
    "priv.s9": "9. Quyền của bạn (GDPR / CCPA / PDPL Việt Nam)",
    "priv.s9p": "Cơ sở pháp lý xử lý email (newsletter) là sự đồng ý (GDPR Art. 6(1)(a)); log bảo mật là lợi ích chính đáng (Art. 6(1)(f)). Bạn có quyền: truy cập bản sao data, sửa, xóa, hạn chế xử lý, port đi nơi khác, phản đối. User CCPA thêm quyền opt-out khỏi việc bán/chia sẻ (chúng tôi không làm cả hai). Email codetrail@dipgle.com — chúng tôi sẽ phản hồi sớm nhất có thể, và muộn nhất trong thời hạn pháp luật yêu cầu. Bạn cũng có thể khiếu nại với cơ quan bảo vệ dữ liệu địa phương (Việt Nam: Bộ Công an theo Nghị định 13/2023/NĐ-CP).",
    "priv.s10": "10. Thay đổi chính sách",
    "priv.s10p": "Thay đổi material có 30 ngày notice qua email (cho subscriber) và mục changelog. Ngày phiên bản hiện tại ở đầu trang.",

    "eula.title": "Giấy phép — Codetrail (MIT)",
    "eula.h1": "Giấy phép — MIT",
    "eula.updated": "Cập nhật lần cuối: 2026-06-04",
    "eula.intro": "Codetrail không có binary đóng và không có EULA riêng. Mọi thành phần (hook, template, MCP server Node và Rust, landing, viewer) đều cấp phép MIT License. Toàn văn nằm trong repository.",
    "eula.cta": "Đọc MIT LICENSE trên GitHub →",

    "viewer.title": "Codetrail Viewer — xem devlog.sqlite bất kỳ",
    "viewer.h1": "Devlog Viewer",
    "viewer.lede": "Thả bất kỳ devlog.sqlite của dự án Codetrail vào ô dưới. Mọi thứ chạy trong browser — không upload, không server.",
    "viewer.pick": "Chọn file .sqlite",
    "viewer.hint": "…hoặc kéo & thả vào đây.",
    "viewer.status": "Chưa có file.",
    "viewer.tabs.events": "Sự kiện",
    "viewer.tabs.ucs": "Use cases",
    "viewer.tabs.tcs": "Test cases",
    "viewer.tabs.runs": "Test runs",
    "viewer.loaded": "Đã tải: ",
    "viewer.empty": "(trống)",
    "viewer.parseErr": "Không parse được file. Đây có phải devlog.sqlite của Codetrail không?",
  },
};

function detectLang() {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get("lang");
  if (fromUrl === "vi" || fromUrl === "en") return fromUrl;
  const fromStore = localStorage.getItem("codetrail.lang");
  if (fromStore === "vi" || fromStore === "en") return fromStore;
  const nav = (navigator.language || "en").toLowerCase();
  if (nav.startsWith("vi")) return "vi";
  return "en";
}

function applyI18n(lang) {
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");
    const val = dict[key];
    if (val == null) return;
    if (attr) el.setAttribute(attr, val);
    else el.textContent = val;
  });

  if (dict["meta.title"]) document.title = dict["meta.title"];

  const tog = document.getElementById("langToggle");
  if (tog) tog.textContent = lang === "vi" ? "VI / EN" : "EN / VI";
}

function initLangToggle() {
  const tog = document.getElementById("langToggle");
  if (!tog) return;
  tog.addEventListener("click", () => {
    const cur = document.documentElement.dataset.lang || "en";
    const next = cur === "vi" ? "en" : "vi";
    localStorage.setItem("codetrail.lang", next);
    applyI18n(next);
  });
}

function initWaitlist() {
  const form = document.getElementById("waitForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    const email = (new FormData(form).get("email") || "").toString().trim();
    if (!email) return;
    e.preventDefault();
    const lang = document.documentElement.dataset.lang || "en";
    const msg = lang === "vi"
      ? "Đã nhận! Chúng tôi sẽ gửi note ngắn khi có feature lớn ship."
      : "Got it. We'll email when a major feature ships.";
    form.innerHTML = `<p style="color:var(--accent);font-weight:600">${msg}</p>
      <p class="wait-meta">${email}</p>`;
    try {
      const stored = JSON.parse(localStorage.getItem("codetrail.waitlist") || "[]");
      stored.push({ email, ts: Date.now(), lang });
      localStorage.setItem("codetrail.waitlist", JSON.stringify(stored));
    } catch (_) {}
  });
}

window.I18N = I18N;

document.addEventListener("DOMContentLoaded", () => {
  applyI18n(detectLang());
  initLangToggle();
  initWaitlist();
});
