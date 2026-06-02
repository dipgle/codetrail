// i18n + language toggle + waitlist UX
// Pure vanilla JS, no framework. Loaded on every page.

const I18N = {
  en: {
    "meta.title": "Codetrail — Persistent memory for AI coding sessions",
    "meta.desc": "Auto-logging devlog, UC/TC tracking, stale-resume warnings. Stop losing context between Claude Code sessions.",

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

    "hero.title": "Your AI coding sessions, remembered.",
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
    "foot.credit": "© Codetrail — served by tfl5",

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
    "meta.title": "Codetrail — Bộ nhớ bền vững cho session AI",
    "meta.desc": "Tự động log devlog, theo dõi UC/TC, cảnh báo session cũ. Đừng mất context giữa các phiên Claude Code nữa.",

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

    "hero.title": "Mọi session AI của bạn, đều được nhớ.",
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
    "foot.credit": "© Codetrail — chạy bởi tfl5",

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
