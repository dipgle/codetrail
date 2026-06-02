// i18n + language toggle + waitlist UX
// Pure vanilla JS, no framework. Loaded on every page.

const I18N = {
  en: {
    "meta.title": "Codetrail — Persistent memory for Claude Code, Cursor, Aider sessions",
    "meta.desc": "Codetrail gives Claude Code persistent memory across sessions: auto-logging devlog, UC/TC tracking, stale-resume warnings. Never re-explain your project to the AI again.",

    "nav.features": "Features",
    "nav.pricing": "Pricing",
    "nav.viewer": "Viewer",
    "nav.waitlist": "Waitlist",

    "price.title": "Pricing",
    "price.lede": "Free forever for solo work. Pay only when you sync across machines or share with a team.",
    "price.free.name": "Free",
    "price.free.amount": "$0",
    "price.free.period": "forever",
    "price.free.tag": "Solo dev, local-only",
    "price.free.f1": "Unlimited projects, local devlog",
    "price.free.f2": "Auto-artifact hook + stale-resume warning",
    "price.free.f3": "Browser viewer (drag-drop)",
    "price.free.f4": "UC / TC / test_run tracking",
    "price.free.f5": "Community support",
    "price.free.cta": "Get started",
    "price.pro.badge": "Most popular",
    "price.pro.name": "Pro",
    "price.pro.amount": "$9",
    "price.pro.period": "/ month",
    "price.pro.tag": "Sync across your machines",
    "price.pro.f1": "Everything in Free, plus:",
    "price.pro.f2": "Cloud sync — 1 user, unlimited devices",
    "price.pro.f3": "Cross-project search across all your devlogs",
    "price.pro.f4": "Web dashboard (no upload needed)",
    "price.pro.f5": "90-day history retention",
    "price.pro.f6": "Priority email support",
    "price.pro.cta": "Start Pro trial",
    "price.team.name": "Team",
    "price.team.amount": "$29",
    "price.team.period": "/ user / month",
    "price.team.tag": "Share AI memory across the team",
    "price.team.f1": "Everything in Pro, plus:",
    "price.team.f2": "Multi-user with role-based access",
    "price.team.f3": "Read-only share links (per project)",
    "price.team.f4": "Audit log + SSO (SAML, OIDC)",
    "price.team.f5": "1-year history retention",
    "price.team.f6": "Slack + onboarding session",
    "price.team.cta": "Talk to us",
    "price.note": "All paid plans start with a 14-day no-card trial. Annual billing saves 20%. Educational / open-source projects: Pro free — just email us.",

    "hero.title": "Stop re-explaining your project to the AI.",
    "hero.lede": "Codetrail turns Claude Code into a persistent project partner: every file edit logged automatically, every use case & test case tracked, stale-context warnings on resume. No more confident-wrong narratives.",
    "hero.ctaPrimary": "Join the waitlist",
    "hero.ctaSecondary": "See it work →",
    "hero.meta": "Built on tfl5. Open beta soon. Free during beta.",
    "stat.projects": "projects dogfooding",
    "stat.events": "events in demo devlog",
    "stat.overhead": "per artifact write",
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
    "cmp.row.local": "Local-first; cloud is opt-in",
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
    "feat.local.title": "Local-first, sync optional",
    "feat.local.body": "SQLite stays on your disk, alongside the code. Cloud dashboard (P2) syncs on your terms. Privacy by default; collab when you want.",

    "how.title": "How it works",
    "how.s1t": "Install",
    "how.s1b": "One bash helper: np my-app scaffolds CLAUDE.md, docs/, memory/, logs/devlog.sqlite, MCP server. Or adopt an existing project in place.",
    "how.s2t": "Work normally",
    "how.s2b": "Open Claude Code. Auto-hooks log every artifact. The MCP server tracks UCs/TCs/test runs as you build. Nothing extra to remember.",
    "how.s3t": "Resume any time",
    "how.s3b": "Days, weeks, multiple agents later — Codetrail surfaces the right context. The narrative comes from data, not stale notes.",

    "wait.title": "Get early access",
    "wait.lede": "We're opening the beta to a small batch of Claude Code power users first. Drop your email and we'll send the install link.",
    "wait.placeholder": "you@example.com",
    "wait.submit": "Notify me",
    "wait.meta": "No spam. One email when access opens. You can leave anytime.",

    "foot.tagline": "Persistent memory for AI coding sessions.",
    "foot.product": "Product",
    "foot.resources": "Resources",
    "foot.docs": "Docs (soon)",
    "foot.legal": "Legal",
    "foot.terms": "Terms",
    "foot.privacy": "Privacy",
    "foot.powered": "Powered by",

    "inst.title": "Install in 30 seconds",
    "inst.lede": "Two helpers: np for new projects, adopt for existing ones. Works on macOS, Linux, and WSL2.",
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
    "faq.a2": "On the Free tier: no. Hooks write to logs/devlog.sqlite on your disk. The web viewer parses SQLite in your browser via WASM — zero upload. On Pro/Team, you opt in to cloud sync per project; we store the SQLite encrypted at rest and never train models on your data.",
    "faq.q3": "What if Claude Code changes its hook API?",
    "faq.a3": "The hooks live in ~/.claude/settings.json and shell out to plain bash scripts that only depend on sqlite3 and Python 3. If the schema or matcher format changes, we ship an update — the migration is a one-line settings edit. The devlog format is independent and we'll always provide a converter.",
    "faq.q4": "Is the code open source?",
    "faq.a4": "The hooks, landing, project template, and SDK clients are MIT — see github.com/dipgle/codetrail. The MCP server binary (project-agent) is closed source; the free tier always includes the hosted binary download under a permissive EULA.",
    "faq.q5": "I already use Cursor / Aider — can I still use Codetrail?",
    "faq.a5": "Codetrail's hooks are Claude Code-specific (they hook into Claude Code's PostToolUse / SessionStart events). The browser viewer is editor-agnostic — drop any compatible SQLite there. Aider and Cursor integrations aren't on the roadmap but the schema is documented; community PRs welcome.",
    "faq.q6": "Pricing in VND?",
    "faq.a6": "Yes — Pro is ~225 000đ/month, Team ~725 000đ/user/month at current rates. We accept VietQR, MoMo, and bank transfer for Vietnamese customers, Stripe for everyone else. Annual billing saves 20% on both currencies.",

    "oss.title": "Open source on GitHub",
    "oss.lede": "Landing, hooks, project template, SDK — MIT-licensed. Drop a star if Codetrail saves you time; file an issue if it doesn't.",
    "oss.cta": "Star on GitHub",

    "terms.title": "Terms of Service — Codetrail",
    "terms.h1": "Terms of Service",
    "terms.updated": "Last updated: 2026-06-03",
    "terms.s1": "1. Use of Codetrail",
    "terms.s1p": "Codetrail provides hooks, a project scaffolder, an MCP server, and a web viewer that help you maintain persistent memory across AI coding sessions. The free tier — including all local-only features — is available to anyone without registration. Paid tiers (Pro, Team) require an account and payment.",
    "terms.s2": "2. Beta status",
    "terms.s2p": "Codetrail is in open beta. APIs, file formats (including the devlog SQLite schema), pricing, and feature scope may change. We will warn you about breaking changes via email and the changelog, but we don't guarantee uptime or backwards compatibility during beta.",
    "terms.s3": "3. Your code, your data",
    "terms.s3p": "Codetrail does not own your code, your devlogs, your use cases, or anything else you produce while using it. The free tier never sends data off your machine. Paid tiers sync data you explicitly opt to sync; you can delete it at any time, and we'll honor that within 30 days.",
    "terms.s4": "4. Source code",
    "terms.s4p": "The landing site, hooks, project template, and SDK clients are MIT-licensed at github.com/dipgle/codetrail. The MCP server binary (project-agent) is closed source; free tier usage is permitted under the binary EULA included in each release.",
    "terms.s5": "5. No warranty",
    "terms.s5p": "Codetrail is provided \"as is\" without warranty of any kind. We work hard to keep it useful and stable, but we can't promise it'll be bug-free or always available. Our liability is limited to the amount you paid us in the last 12 months.",
    "terms.s6": "6. Contact",
    "terms.s6p": "Questions, complaints, or DMCA notices: hello@codetrail.dipgle.com.",
    "terms.s7": "7. Governing law & disputes",
    "terms.s7p": "These terms are governed by the laws of the Socialist Republic of Vietnam. Any dispute that cannot be resolved by good-faith email exchange within 30 days may be submitted to the competent courts of Hanoi. EU/EEA and UK users retain mandatory rights under their local consumer law that override this clause where it conflicts.",
    "legal.back": "Back to home",

    "privacy.title": "Privacy Policy — Codetrail",
    "priv.h1": "Privacy Policy",
    "priv.updated": "Last updated: 2026-06-03",
    "priv.s1": "Local-first by default",
    "priv.s1p": "If you only use the free tier of Codetrail (hooks, template, browser viewer), no data leaves your machine, ever. The viewer parses SQLite files entirely in your browser via WASM — there is no upload, no server round-trip. We literally cannot see your devlog.",
    "priv.s2": "What we collect on this website",
    "priv.s2l1": "Email addresses you submit via the waitlist form, used only to email you when beta access opens.",
    "priv.s2l2": "Standard server logs (IP, user agent, requested path) retained 30 days for abuse prevention. Not used for advertising.",
    "priv.s2l3": "No third-party analytics or trackers (no Google Analytics, no Facebook pixel, no fingerprinting).",
    "priv.s3": "Paid tiers (Pro, Team)",
    "priv.s3p": "When you sync devlogs to the cloud (Pro/Team feature), we store the SQLite contents encrypted at rest, scoped to your account. We never train models on your devlog, never share with third parties, never look at it except when you grant explicit support access. Delete your account → your data is purged within 30 days.",
    "priv.s4": "Cookies",
    "priv.s4p": "A single session cookie when you log in (Pro/Team). No tracking cookies. No advertising cookies. No \"we use cookies, click OK\" theater.",
    "priv.s5": "Your rights (GDPR / CCPA / Vietnamese PDPL)",
    "priv.s5p": "Our lawful basis for processing your email (waitlist) is your consent (GDPR Art. 6(1)(a)); for paid-tier syncs it is contract performance (Art. 6(1)(b)); for security logs it is legitimate interest (Art. 6(1)(f)). You have the right to: access a copy of your data, rectify it, erase it, restrict processing, port it elsewhere, and object. CCPA users additionally have the right to opt out of any sale or share (we do neither). Email hello@codetrail.dipgle.com — we respond within 30 days.",

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
    "meta.desc": "Codetrail cho Claude Code memory bền vững giữa các phiên: tự động log devlog, theo dõi UC/TC, cảnh báo session cũ. Đừng giải thích lại dự án cho AI mỗi lần.",

    "nav.features": "Tính năng",
    "nav.pricing": "Giá",
    "nav.viewer": "Xem devlog",
    "nav.waitlist": "Đăng ký sớm",

    "price.title": "Bảng giá",
    "price.lede": "Miễn phí vĩnh viễn cho cá nhân làm việc local. Chỉ trả tiền khi cần sync nhiều máy hoặc share với team.",
    "price.free.name": "Free",
    "price.free.amount": "0đ",
    "price.free.period": "mãi mãi",
    "price.free.tag": "Dev cá nhân, chỉ local",
    "price.free.f1": "Không giới hạn dự án, devlog local",
    "price.free.f2": "Auto-log artifact + cảnh báo session cũ",
    "price.free.f3": "Viewer browser (kéo thả)",
    "price.free.f4": "Theo dõi UC / TC / test_run",
    "price.free.f5": "Hỗ trợ cộng đồng",
    "price.free.cta": "Bắt đầu miễn phí",
    "price.pro.badge": "Phổ biến nhất",
    "price.pro.name": "Pro",
    "price.pro.amount": "$9",
    "price.pro.period": "/ tháng",
    "price.pro.tag": "Sync nhiều máy của bạn",
    "price.pro.f1": "Mọi tính năng Free, cộng thêm:",
    "price.pro.f2": "Cloud sync — 1 user, không giới hạn thiết bị",
    "price.pro.f3": "Tìm kiếm xuyên dự án",
    "price.pro.f4": "Dashboard web (không cần upload)",
    "price.pro.f5": "Lưu lịch sử 90 ngày",
    "price.pro.f6": "Hỗ trợ email ưu tiên",
    "price.pro.cta": "Thử Pro",
    "price.team.name": "Team",
    "price.team.amount": "$29",
    "price.team.period": "/ user / tháng",
    "price.team.tag": "Chia sẻ AI memory cả team",
    "price.team.f1": "Mọi tính năng Pro, cộng thêm:",
    "price.team.f2": "Multi-user với role-based access",
    "price.team.f3": "Share link read-only (theo dự án)",
    "price.team.f4": "Audit log + SSO (SAML, OIDC)",
    "price.team.f5": "Lưu lịch sử 1 năm",
    "price.team.f6": "Slack + onboarding session",
    "price.team.cta": "Liên hệ",
    "price.note": "Mọi gói paid có 14 ngày dùng thử không cần card. Trả năm tiết kiệm 20%. Dự án giáo dục / open source: Pro miễn phí — gửi email cho chúng tôi.",

    "hero.title": "Đừng giải thích lại dự án cho AI mỗi lần.",
    "hero.lede": "Codetrail biến Claude Code thành đối tác dự án bền vững: mọi edit tự động log, mọi use case & test case được theo dõi, cảnh báo context cũ khi resume. Không còn câu chuyện tự tin sai nữa.",
    "hero.ctaPrimary": "Đăng ký sớm",
    "hero.ctaSecondary": "Xem demo →",
    "hero.meta": "Dựng trên tfl5. Mở beta sớm. Miễn phí trong beta.",
    "stat.projects": "dự án đang dogfood",
    "stat.events": "events trong demo devlog",
    "stat.overhead": "mỗi artifact ghi",
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
    "cmp.row.local": "Local-first; cloud tùy chọn",
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
    "feat.local.title": "Local-first, sync tùy bạn",
    "feat.local.body": "SQLite ở đĩa của bạn, cạnh code. Cloud dashboard (P2) sync theo điều kiện bạn. Mặc định riêng tư; collab khi cần.",

    "how.title": "Hoạt động thế nào",
    "how.s1t": "Cài",
    "how.s1b": "Một bash helper: np my-app scaffold CLAUDE.md, docs/, memory/, logs/devlog.sqlite, MCP server. Hoặc adopt dự án sẵn có tại chỗ.",
    "how.s2t": "Làm việc bình thường",
    "how.s2b": "Mở Claude Code. Auto-hook log mọi artifact. MCP server theo dõi UC/TC/test runs khi bạn build. Không cần nhớ thêm gì.",
    "how.s3t": "Resume bất kỳ lúc nào",
    "how.s3b": "Ngày, tuần, nhiều agent sau — Codetrail surface đúng context. Câu chuyện đến từ data, không phải note cũ.",

    "wait.title": "Truy cập sớm",
    "wait.lede": "Beta đầu mở cho một nhóm nhỏ power user Claude Code. Để lại email, chúng tôi gửi link cài.",
    "wait.placeholder": "ban@example.com",
    "wait.submit": "Thông báo cho tôi",
    "wait.meta": "Không spam. Một email khi mở. Có thể out bất cứ lúc nào.",

    "foot.tagline": "Bộ nhớ bền vững cho session AI.",
    "foot.product": "Sản phẩm",
    "foot.resources": "Tài liệu",
    "foot.docs": "Docs (sắp có)",
    "foot.legal": "Pháp lý",
    "foot.terms": "Điều khoản",
    "foot.privacy": "Bảo mật",
    "foot.powered": "Chạy bởi",

    "inst.title": "Cài trong 30 giây",
    "inst.lede": "Hai helper: np tạo project mới, adopt cho project có sẵn. Hỗ trợ macOS, Linux, WSL2.",
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
    "faq.a2": "Free tier: không. Hook ghi vào logs/devlog.sqlite trên đĩa bạn. Web viewer parse SQLite trong browser qua WASM — zero upload. Pro/Team: bạn opt-in cloud sync theo project; chúng tôi lưu SQLite encrypted at rest, không bao giờ train model trên data của bạn.",
    "faq.q3": "Nếu Claude Code đổi hook API thì sao?",
    "faq.a3": "Hook nằm trong ~/.claude/settings.json và gọi bash script chỉ phụ thuộc sqlite3 + Python 3. Nếu schema hay matcher đổi, chúng tôi ship update — migration chỉ 1 dòng settings. Format devlog độc lập và luôn có converter.",
    "faq.q4": "Có open source không?",
    "faq.a4": "Hook, landing, project template, SDK clients đều MIT — xem github.com/dipgle/codetrail. MCP binary (project-agent) là closed source; free tier luôn được tải binary qua EULA permissive.",
    "faq.q5": "Tôi đang dùng Cursor / Aider — vẫn dùng Codetrail được không?",
    "faq.a5": "Hook của Codetrail Claude Code-specific (gắn vào PostToolUse / SessionStart của Claude Code). Browser viewer agnostic — thả SQLite tương thích vào. Integration Aider/Cursor chưa có trong roadmap nhưng schema đã document; community PR welcome.",
    "faq.q6": "Giá bằng VND?",
    "faq.a6": "Có — Pro ~225 000đ/tháng, Team ~725 000đ/user/tháng theo tỷ giá hiện tại. Chúng tôi nhận VietQR, MoMo, chuyển khoản cho khách Việt; Stripe cho khách quốc tế. Trả năm tiết kiệm 20% cả 2 currency.",

    "oss.title": "Open source trên GitHub",
    "oss.lede": "Landing, hooks, project template, SDK — MIT-licensed. Star nếu Codetrail giúp bạn; mở issue nếu chưa.",
    "oss.cta": "Star trên GitHub",

    "terms.title": "Điều khoản dịch vụ — Codetrail",
    "terms.h1": "Điều khoản dịch vụ",
    "terms.updated": "Cập nhật lần cuối: 2026-06-03",
    "terms.s1": "1. Sử dụng Codetrail",
    "terms.s1p": "Codetrail cung cấp hook, project scaffolder, MCP server và web viewer giúp bạn duy trì memory bền vững giữa các phiên AI coding. Free tier — bao gồm mọi tính năng local-only — miễn phí cho mọi người, không cần đăng ký. Pro/Team yêu cầu tài khoản + thanh toán.",
    "terms.s2": "2. Trạng thái beta",
    "terms.s2p": "Codetrail đang ở open beta. API, format file (gồm schema devlog SQLite), giá, và phạm vi tính năng có thể thay đổi. Chúng tôi sẽ cảnh báo breaking change qua email và changelog, nhưng không cam kết uptime hoặc backwards compatibility trong beta.",
    "terms.s3": "3. Code và data của bạn",
    "terms.s3p": "Codetrail không sở hữu code, devlog, use case, hay bất cứ thứ gì bạn tạo ra khi dùng nó. Free tier không bao giờ gửi data rời khỏi máy. Pro/Team sync data bạn explicitly opt-in; bạn có thể xóa bất cứ lúc nào, chúng tôi xử trong 30 ngày.",
    "terms.s4": "4. Mã nguồn",
    "terms.s4p": "Landing, hook, project template, và SDK client đều MIT tại github.com/dipgle/codetrail. MCP server binary (project-agent) closed source; free tier usage được phép qua EULA kèm theo mỗi release.",
    "terms.s5": "5. Không bảo hành",
    "terms.s5p": "Codetrail được cung cấp \"as is\" không bảo hành. Chúng tôi làm hết sức cho nó hữu ích và ổn định, nhưng không cam kết bug-free hay luôn available. Trách nhiệm pháp lý giới hạn ở số tiền bạn đã trả trong 12 tháng gần nhất.",
    "terms.s6": "6. Liên hệ",
    "terms.s6p": "Câu hỏi, khiếu nại, hoặc DMCA: hello@codetrail.dipgle.com.",
    "terms.s7": "7. Luật áp dụng & giải quyết tranh chấp",
    "terms.s7p": "Điều khoản này áp dụng theo luật pháp Việt Nam. Tranh chấp không giải quyết được qua email trong 30 ngày có thể đưa ra Tòa án có thẩm quyền tại Hà Nội. User EU/EEA và UK giữ các quyền bắt buộc theo luật tiêu dùng địa phương nếu xung đột với điều khoản này.",
    "legal.back": "Về trang chủ",

    "privacy.title": "Chính sách bảo mật — Codetrail",
    "priv.h1": "Chính sách bảo mật",
    "priv.updated": "Cập nhật lần cuối: 2026-06-03",
    "priv.s1": "Mặc định local-first",
    "priv.s1p": "Nếu bạn chỉ dùng free tier của Codetrail (hook, template, browser viewer), không có data nào rời máy bạn, không bao giờ. Viewer parse SQLite file hoàn toàn trong browser qua WASM — không upload, không server round-trip. Chúng tôi đơn giản là không thấy devlog của bạn.",
    "priv.s2": "Website này thu thập gì",
    "priv.s2l1": "Email bạn gửi qua form waitlist, chỉ dùng để thông báo khi mở beta.",
    "priv.s2l2": "Server log thường (IP, user agent, path) giữ 30 ngày để phòng abuse. Không dùng cho quảng cáo.",
    "priv.s2l3": "Không analytics bên thứ 3, không tracker (không Google Analytics, không Facebook pixel, không fingerprinting).",
    "priv.s3": "Pro / Team tier",
    "priv.s3p": "Khi bạn sync devlog lên cloud (tính năng Pro/Team), chúng tôi lưu SQLite encrypted at rest, scope theo account bạn. Không train model trên devlog, không chia sẻ với bên thứ 3, không xem trừ khi bạn explicit grant support access. Xóa account → data bị xóa trong 30 ngày.",
    "priv.s4": "Cookie",
    "priv.s4p": "Một session cookie duy nhất khi bạn login (Pro/Team). Không tracking cookie. Không quảng cáo cookie. Không trò \"chúng tôi dùng cookie, click OK\" vô nghĩa.",
    "priv.s5": "Quyền của bạn (GDPR / CCPA / PDPL Việt Nam)",
    "priv.s5p": "Cơ sở pháp lý xử lý email (waitlist) là sự đồng ý của bạn (GDPR Art. 6(1)(a)); sync Pro/Team là thực hiện hợp đồng (Art. 6(1)(b)); log bảo mật là lợi ích chính đáng (Art. 6(1)(f)). Bạn có quyền: truy cập bản sao data, sửa, xóa, hạn chế xử lý, port đi nơi khác, và phản đối. User CCPA thêm quyền opt-out khỏi việc bán/chia sẻ (chúng tôi không làm cả hai). Email hello@codetrail.dipgle.com — chúng tôi trả lời trong 30 ngày.",

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
    // P0 stub: mailto fallback already wired. We override here to give
    // immediate confirmation feedback without leaving the page.
    e.preventDefault();
    const lang = document.documentElement.dataset.lang || "en";
    const msg = lang === "vi"
      ? "Đã nhận! Chúng tôi sẽ gửi email khi mở beta."
      : "Got it. We'll email when the beta opens.";
    form.innerHTML = `<p style="color:var(--accent);font-weight:600">${msg}</p>
      <p class="wait-meta">${email}</p>`;
    // P1 wires this to a real waitlist endpoint.
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
