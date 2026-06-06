# Quickstart — 1 trang cho người mới

## Supported platforms

| OS | Status | Notes |
|---|---|---|
| **macOS** (Apple Silicon + Intel) | ✅ First-class | Binary ship sẵn |
| **Linux** (x86_64, aarch64) | ✅ First-class | Binary ship sẵn |
| **Windows 10/11** | ✅ Via WSL2 | Setup WSL2 trước, rồi follow Linux instructions |

### Windows users: setup WSL2 trước

PowerShell admin:
```powershell
wsl --install -d Ubuntu
# Restart máy nếu được yêu cầu, mở Ubuntu app, setup user
```

Sau đó MỌI lệnh trong tài liệu này chạy trong WSL2 Ubuntu terminal. Claude Code CLI cũng cài vào WSL2 (`brew` không có sẵn — dùng `npm install -g @anthropic-ai/claude-code` hoặc cách install Anthropic recommend).

VSCode + Claude Code extension trên Windows tự động connect vào WSL2 khi mở folder trong WSL filesystem (`\\wsl$\Ubuntu\home\...`).

Bạn cần làm 2 thứ:

## 1. Setup 1 lần (3 phút)

Mở terminal (macOS/Linux native, hoặc WSL2 Ubuntu trên Windows), paste:

```bash
echo '
# Claude project helpers
np() {
  # Bootstrap NEW project (scaffold + open Claude)
  [ -z "$1" ] && { echo "Usage: np <name|path>"; return 1; }
  local DIR
  if [[ "$1" == */* ]]; then DIR="$1"
  else DIR="$HOME/Documents/projects/AI/$1"
  fi
  ~/Documents/projects/AI/init-project/startup.sh "$DIR" || return 1
  cd "$DIR" && claude
}

adopt() {
  # Adopt EXISTING project (in-place, idempotent, no auto-open)
  local DIR="${1:-$(pwd)}"
  [ ! -d "$DIR" ] && { echo "Not a dir: $DIR"; return 1; }
  local BEFORE=$(find "$DIR" -maxdepth 2 -type f 2>/dev/null | sort)
  ~/Documents/projects/AI/init-project/startup.sh "$DIR" || return 1
  local AFTER=$(find "$DIR" -maxdepth 2 -type f 2>/dev/null | sort)
  echo ""
  echo "=== Files added ==="
  comm -13 <(echo "$BEFORE") <(echo "$AFTER")
  echo ""
  echo "Next: review, then  cd \"$DIR\" && claude"
}
' >> ~/.zshrc
source ~/.zshrc
```

Xong. Bạn có 2 lệnh: `np` (new) và `adopt` (existing).

## 2. Bắt đầu — 3 trường hợp

### A. Dự án MỚI từ đầu

```bash
np my-app
```

Tạo `~/Documents/projects/AI/my-app/`, scaffold đủ template, mở Claude.

### B. Dự án CŨ đã có code (chưa từng dùng AI tooling)

```bash
cd /path/to/existing-project
adopt
```

`adopt` chạy idempotent — **không đụng** code cũ, chỉ THÊM files thiếu:
- `CLAUDE.md`, `PLAN.md`, `TODO.md` (nếu chưa có)
- `docs/` `memory/` `logs/devlog.sqlite`
- `.mcp.json` register MCP

Cuối lệnh sẽ liệt kê đúng các files đã thêm để bạn review. Sau đó:
```bash
claude
```

### C. Đang dùng AI tooling khác (Cursor / Aider / custom)

Cùng lệnh `adopt`. Coexist được vì:
- Claude Code **chỉ đọc** `CLAUDE.md` + `.mcp.json` — KHÔNG đụng `.cursorrules`, `.aider.conf`, hay setup khác
- Nếu bạn đã có `CLAUDE.md` riêng → `adopt` không overwrite
- Bạn có thể chạy Cursor và Claude Code song song trên cùng codebase

```bash
cd /path/to/cursor-project
adopt           # chỉ thêm MCP devlog + docs structure
claude          # start Claude session (Cursor vẫn dùng được)
```

Trong Claude, bạn **chỉ cần chat tự nhiên** — Claude sẽ tự chạy discovery dialog hỏi bạn 6 thứ:
1. **Vision** — sản phẩm này là gì, cho ai
2. **Primary actor** — người dùng chính
3. **Success** — đo lường thế nào
4. **Non-goals** — KHÔNG làm gì
5. **Constraints** — tech stack, deadline, compliance
6. **Initial UCs** — 3–7 use cases đầu tiên

Sau khi 6 phần đó xong, Claude tự chuyển sang TDD: tạo test case → run RED → implement code → run GREEN.

## Đó là tất cả

Phần dưới là **optional**, chỉ đọc khi cần.

---

## Optional — Layer 1: utilities (nếu muốn quan sát tốt hơn)

| Tool | Lệnh | Khi nào dùng |
|------|------|--------------|
| Real-time monitor | `node ~/Documents/projects/AI/init-project/mcp/monitor.js logs/devlog.sqlite` | Mở terminal khác để xem realtime UC/TC/events |

## Optional — Layer 2: vault (nếu cần secrets cho autonomous)

Chỉ build khi bạn muốn Claude chạy command có secret (DB password, API key)
**mà không bao giờ thấy giá trị thật**:

```bash
cd ~/Documents/projects/AI/init-project/mcp/vault
cargo build --release
# Xem mcp/vault/README.md cho hướng dẫn dùng
```

## Optional — Layer 3: question discipline hook

Hook chặn Claude hỏi linh tinh khi chưa research. **Đã active** ở `~/.claude/settings.json`. Xem [.claude/hooks/](.claude/hooks/) nếu muốn tweak.

---

## Troubleshooting

| Vấn đề | Fix |
|--------|-----|
| `np: command not found` | Chạy `source ~/.zshrc` hoặc mở terminal mới |
| `claude: command not found` | Cài Claude Code: https://claude.com/code |
| MCP không show trong `/mcp` | Đảm bảo bạn ở đúng dir; check có `.mcp.json` không |
| Discovery dialog không tự chạy | Check `docs/kickoff.md` có trống không — nếu có nội dung Claude sẽ skip |
| (Windows) "command not found" trong PowerShell | Lệnh phải chạy trong WSL2 Ubuntu, không PowerShell |
| (Windows) VSCode không thấy WSL files | `File → Open Folder → \\wsl$\Ubuntu\home\<you>\...` hoặc cài VSCode "WSL" extension |
| (Windows) MCP binary "Exec format error" | Đang chạy macOS binary trên Linux/WSL — đảm bảo download đúng arch (Linux x86_64) |

## Cấu trúc project sau khi `np`

```
my-app/
├── CLAUDE.md          ← Claude đọc (không cần bạn đọc)
├── PLAN.md            ← Plan hiện tại
├── TODO.md            ← Task list
├── .mcp.json          ← Register MCP devlog
├── runner.sh          ← Allowlist command queue (bash, macOS/Linux/WSL)
├── runner.ps1         ← Same thing, PowerShell port (native Windows)
├── .cmd-queue/        ← Claude drops <id>.cmd here
├── .cmd-results/      ← Daemon writes <id>.log here + audit.log + runner.pid
├── docs/
│   ├── kickoff.md     ← Discovery dialog fill
│   ├── architecture.md
│   ├── conventions.md
│   ├── decision-log.md
│   ├── use-cases.md   ← Mirror UC từ DB
│   └── test-cases.md  ← Mirror TC từ DB
├── memory/
│   ├── active-context.md       ← Session state
│   ├── session-summary.md
│   └── discovered-knowledge.md
└── logs/
    └── devlog.sqlite  ← Source of truth (events, UC, TC, runs)
```

## Optional — Layer 4: runner daemon (sandbox escape hatch)

Khi Claude Code sandbox (hoặc CI / remote agent) không cho assistant exec
shell trực tiếp, dùng `runner.sh` (macOS/Linux/WSL) hoặc `runner.ps1`
(native Windows) như queue trung gian:

```bash
# macOS/Linux/WSL — daemon auto-start lúc np/adopt; quản lý:
bash runner.sh status
bash runner.sh exec "npm test"      # one-shot: auto-start nếu chưa, enqueue, đợi, in
bash runner.sh stop

# Windows native (không qua WSL2):
pwsh -File runner.ps1 start
pwsh -File runner.ps1 exec "npm test"
pwsh -File runner.ps1 stop
```

Allowlist rỗng mặc định — edit `ALLOWLIST_EXACT` / `ALLOWLIST_PREFIX` trong
script để cho phép command. Audit ở `.cmd-results/audit.log`. Skip auto-spawn
qua env `CODETRAIL_NO_RUNNER=1`. **Không chạy cả hai cùng project** — chúng
race trên cùng queue files.
