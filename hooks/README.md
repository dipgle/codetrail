# Codetrail Claude Code Hooks — and how to build the workspace they run in

Two things live in this document:

1. **Reference** for the hooks themselves — what each one is, which event it
   binds to, what it does.
2. **A from-scratch recipe** for the multi-project workspace these hooks were
   designed for, reproducing the layout described below. Follow it top to
   bottom on a fresh machine and you end up with the same tree, the same
   permission model, the same MCP wiring, and the same daemon.

The hooks back the [template/CLAUDE.md](../template/CLAUDE.md) HARD RULES with
real enforcement. The CLAUDE.md rules are text the model reads and
self-applies; these hooks are bash scripts the Claude Code harness runs
**outside** the model's control — they redact, deny, audit, and remind without
depending on the model's discipline.

> **Who runs the install.** Every step that writes to `~/.claude/` or to a
> `.claude/` directory must be run by a human in a terminal. Claude cannot do
> it: editing Claude config from inside a session is a hard-deny in the auto
> mode classifier and no permission rule clears it. An agent reading this file
> should hand the commands to the user, not attempt them.

---

## What's here

| File | Event | What it does |
|------|-------|--------------|
| `cred-scrubber.sh` | `UserPromptSubmit` | Detect cred-shaped literals in your prompt → allocate stable `<cred-N>` placeholder → store real value in `~/.claude/vault/<session>.json` (chmod 600). Warns the model to refer by placeholder. |
| `cred-pre-tool.sh` | `PreToolUse` (`Read\|Bash`) | Deny tool calls that try to read known secret paths (`.env`, `id_rsa`, `~/.aws/credentials`, `*.pem`, etc.). Allow `.env.example`, `id_rsa.pub`, write/move/list ops. |
| `cred-post-tool.sh` | `PostToolUse` (`Read\|Bash\|Grep\|mcp__`) | Backstop: scan tool output for cred shapes. Vault the value, append audit log, warn the model not to echo. Set `CRED_SCRUB_TOOL_BLOCK=1` to escalate to hard block. |
| `vault-get.sh` | helper (not registered) | Resolve `<cred-N>` → real value at shell exec time. Use in Bash like `pass="$(vault-get.sh <session> cred-1)"`. |
| `auto-adopt.sh` | `SessionStart` (`startup`) | Detect unadopted folders under `$CLAUDE_PROJECTS_ROOT`. Inform Claude (or auto-scaffold via `$CLAUDE_ADOPT_SCRIPT` if `CLAUDE_AUTO_ADOPT=1`). |
| `devlog-resume-check.sh` | `SessionStart` (`startup`) | Compare newest file mtime against last devlog event. If gap > 1h, warn that resume narrative is likely stale. |
| `runner-ensure.sh` | `SessionStart` (`startup`) | If cwd has `.runner-allowlist`, invoke `$CODETRAIL_HOME/scripts/daemon-ctl.sh ensure <cwd>`. Idempotent via daemon-ctl's PID check. Covers post-clone / post-reboot gap where the per-project daemon hasn't been spawned on this machine yet. |
| `devlog-artifact.sh` | `PostToolUse` (`Edit\|Write\|NotebookEdit`) | Walk up from edited file → log `kind=artifact` event into the nearest `logs/devlog.sqlite`. Removes the "remember to log" burden. |
| `log-source-tools.sh` | `PostToolUse` (`WebFetch\|WebSearch\|ReadMcpResourceTool`) | Append each external lookup to `~/.claude/source-log.jsonl`. Feeds `question-discipline.sh`. |
| `question-discipline.sh` | `Stop` | If last assistant turn ended with a question and no `kind=source` event in devlog or source-log in last 30 min → emit `QUESTION_DISCIPLINE_VIOLATION` reminder. |
| `rule6-visual-artifact-reminder.sh` | `PostToolUse` (`Edit\|Write\|NotebookEdit`) | When edited file is `.svg/.html/.png/.d2/.mmd/...`, print HARD RULE #6 render-and-audit reminder to transcript. |

---

## Target layout

The workspace is a **parent folder holding many project folders**, one Claude
Code session per project, all sharing one governance file and one daemon
mechanism.

```
~/projects/                        # workspace root — NOT under ~/Documents (see below)
├── CLAUDE.md                      # governance: rules every session loads
├── OPERATING-CHARTER.md           # long-form evidence behind the rules
├── .claude/
│   ├── settings.json              # permissions + env + plugins (shared, committable)
│   └── settings.local.json        # per-machine allow rules, MCP opt-ins
├── .mcp.json                      # project-agent (router) + vault MCP servers
├── scripts/                       # workspace-level fleet ops
│   ├── runner.sh                  # file-queue daemon
│   ├── daemon-ctl.sh              # start/stop/restart/status per project
│   └── ensure-all-runners.sh      # sweep: ensure a daemon per project
├── AI/                            # most projects live one level down
│   ├── codetrail/                 # this repo — hooks, MCP servers, template
│   ├── <project>/
│   │   ├── CLAUDE.md              # project-specific rules
│   │   ├── PLAN.md
│   │   ├── memory/active-context.md
│   │   ├── logs/devlog.sqlite     # hooks write here
│   │   ├── .runner-allowlist      # what the daemon may run
│   │   ├── .runner-commands       # optional @name → command library
│   │   └── scripts/.cmd-queue/    # job inbox  (+ .cmd-results/)
│   └── ...
└── <project>/                     # some projects sit directly under the root
```

**Keep the root out of `~/Documents`, `~/Desktop`, and `~/Downloads`.** macOS
gates those three with TCC, and that grant is cached per process and flickers
mid-session — `stat` succeeds, `open` returns EPERM, a minute later it works
again, even with Full Disk Access granted. A folder outside those trees has no
permission to lose. A symlink does not help: resolving it still reads an entry
inside `~/Documents`.

---

## Install from scratch

### 0. Prerequisites

| Need | For | Check |
|---|---|---|
| Claude Code | everything | `claude --version` |
| `python3` | `install.sh` merges settings.json with it | `python3 -V` |
| `jq` | verification steps below | `jq --version` |
| Node 20+ | `project-agent-node`, `vault-node` | `node -v` |
| Node 22+ | `mcp/monitor.js` (uses built-in `node:sqlite`) | `node -v` |
| Rust toolchain | only if you pick `project-agent-rs` | `cargo -V` |

### 1. Create the workspace root and clone codetrail

```bash
mkdir -p ~/projects/AI
git clone https://github.com/<you>/codetrail.git ~/projects/AI/codetrail
export CODETRAIL_HOME=~/projects/AI/codetrail
```

Put `CODETRAIL_HOME` in your shell profile — `runner-ensure.sh` reads it to
locate `daemon-ctl.sh`.

### 2. Install the hooks

```bash
bash ~/projects/AI/codetrail/hooks/install.sh --dry-run   # preview
bash ~/projects/AI/codetrail/hooks/install.sh             # apply
```

The installer:

1. Copies each hook to `~/.claude/hooks/` (chmod +x). A destination newer than
   the repo copy is skipped unless you pass `--force`.
2. Merges hook registrations into `~/.claude/settings.json` — preserves all
   existing keys and dedupes by command path, so re-running is a no-op.

Verify, then reload the session so the entries take effect:

```bash
jq '.hooks | keys' ~/.claude/settings.json
```

### 3. Write the root CLAUDE.md

`~/projects/CLAUDE.md` is the file every session in every project loads. It is
the only tier that can carry a rule the model must apply on **every** turn —
memory-file bodies are not loaded into context, so a rule that must fire each
time belongs here (or in a hook), written as TRIGGER → CHECK.

Start from [`../template/CLAUDE.md`](../template/CLAUDE.md) and add, at minimum:

- how to resolve a bare project name to a folder (session entry);
- the definition of done the project holds itself to;
- which commands go through the daemon rather than direct Bash;
- where deliverables live — files the agent produces belong in the project
  tree, handed back as a path, not published to an external service or
  answered with a hosted link (template HARD RULE 8);
- what to do when a `PreToolUse` reviewer returns BLOCK, written as
  TRIGGER → CHECK. That reviewer is an LLM, so it is not deterministic and a
  block ends the entire turn; the recipe that gets a legitimate command
  through is in the template under *WHEN A PreToolUse REVIEWER RETURNS
  BLOCK*. Its core finding is worth repeating here: **the reviewer reads the
  Bash tool's `description` field as well as the command**, so the
  description has to carry the safety properties — same `git push`, blocked
  twice as "Push commit to origin main", allowed immediately as "Non-force
  fast-forward push, repo pinned with -C, verified toplevel + branch main,
  no --force, no history rewrite".

### 4. Permissions — `~/projects/.claude/settings.json`

```json
{
  "permissions": {
    "defaultMode": "auto",
    "allow": ["Bash(*)"],
    "additionalDirectories": ["/tmp"]
  },
  "env": {
    "CLAUDE_PROJECTS_ROOT": "/Users/<you>/projects",
    "CLAUDE_ADOPT_SCRIPT": "/Users/<you>/projects/AI/codetrail/template/startup.sh"
  },
  "effortLevel": "xhigh",
  "theme": "dark",
  "tui": "fullscreen"
}
```

Three things worth knowing before you change this block:

- **Settings layer user → project → local, later overriding earlier.** A rule
  in `~/projects/.claude/settings.json` beats the same key in
  `~/.claude/settings.json`. Putting the workspace's permission policy here —
  not in the user-level file — keeps it with the workspace.
- **`"defaultMode": "bypassPermissions"` does not engage from a settings file
  alone.** It requires the accepted-dangerous-mode flag
  (`skipDangerousModePermissionPrompt`); without it the session silently falls
  back and every write-class Bash call is refused by the classifier. Use
  `"auto"` plus an explicit allow rule instead.
- **In auto mode, allow rules still win.** `autoMode.classifyAllShell` defaults
  to `false`, so `Bash(*)` in `allow` short-circuits the classifier for shell
  commands. Setting it to `true` routes every command through the classifier
  regardless of allow rules — safer, and much chattier.

Narrow `Bash(*)` if you want per-command review; that is the knob, and it is a
real trade-off, not a formality.

### 5. MCP — `~/projects/.mcp.json`

Build one project-agent implementation, then register it in **router mode** so
a single server covers every adopted project.

```bash
# Node (default; recommended)
cd ~/projects/AI/codetrail/mcp/project-agent-node && npm install && npx tsc

# or Rust
cd ~/projects/AI/codetrail/mcp/project-agent-rs && cargo build --release
```

```json
{
  "mcpServers": {
    "project-agent": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/<you>/projects/AI/codetrail/mcp/project-agent-node/dist/server.js"],
      "env": { "PROJECTS_ROOT": "/Users/<you>/projects" }
    },
    "vault": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/<you>/projects/AI/codetrail/mcp/vault-node/dist/server.js"],
      "env": { "VAULT_EXTRA_COMMANDS": "node" }
    }
  }
}
```

For the Rust build, swap `command` to the binary at
`mcp/project-agent-rs/target/release/project-agent` and drop `args`.

Then opt the servers in — MCP servers declared in `.mcp.json` stay inert until
approved:

```json
{ "enabledMcpjsonServers": ["project-agent", "vault"] }
```

in `~/projects/.claude/settings.local.json`.

**Router mode changes the tool signatures.** Every tool takes a `project`
parameter: `get_context_brief {project}`, `recent_events {project, …}`,
`log_event {project, …}`. Only `list_projects` takes none. The workspace-mode
tools (`save_memory`, `add_knowledge`, `search_knowledge`) are not exposed in
router mode — they are bound to a single project's directories.

The full tool surface, identical across both implementations: `log_event`,
`create_use_case`, `create_test_case`, `record_test_run`, `list_use_cases`,
`list_test_cases`, `recent_events`, `scan_health`, `get_context_brief`,
`next_task`, `list_projects`.

Verify the server actually connected before relying on it — a server listed in
`.mcp.json` that failed to start is indistinguishable from one that is merely
quiet. If `list_projects` is not callable, fall back to reading the devlog
directly:

```bash
sqlite3 ~/projects/AI/<project>/logs/devlog.sqlite \
  "SELECT ts,kind,content FROM events ORDER BY id DESC LIMIT 20"
```

### 6. The file-queue daemon

Some operations the user has authorized still get refused by the permission
classifier — production deploys, fleet scripts, anything that reads as
self-modification. The daemon is the sanctioned path for those: a plain user
process that evaluates queued command files **outside** the classifier, bounded
by a per-project allowlist the user controls.

```bash
mkdir -p ~/projects/scripts
cp ~/projects/AI/codetrail/scripts/{runner.sh,daemon-ctl.sh} ~/projects/scripts/
```

Give a project an allowlist — two sections, `[exact]` and `[prefix]`; anything
not matching is `REJECTED`:

```
# <project>/.runner-allowlist — daemon cwd is <project>/scripts/
# Use absolute paths so cwd cannot leak between sequential evals.

[prefix]
bash ./deploy-
cd /Users/<you>/projects/<project> && ./app-push api -a save assets/
```

Optionally add `<project>/.runner-commands`, a `name : command` map re-read on
**every** job, so new commands need no daemon restart. Call it by writing
`@name arg1 arg2`; `@list` prints the library. Parameters are validated
character by character and a wrong count is `REJECTED` with the correct
template rather than run truncated. **The library grants nothing** — the
mapped command still has to match `.runner-allowlist`.

Start it:

```bash
bash ~/projects/scripts/daemon-ctl.sh ensure <project>
bash ~/projects/scripts/daemon-ctl.sh status <project>
```

`daemon-ctl.sh` takes `ensure | start | stop | restart | status | list`, and a
bare project name resolves under `~/projects/AI/<name>/` then
`~/projects/<name>/`. Run `restart` after editing an allowlist.

Enqueue a job — pure file writes plus a poll, no privileged call:

```bash
ID="job-$(date +%s)"
Q=~/projects/<project>/scripts/.cmd-queue
R=~/projects/<project>/scripts/.cmd-results
mkdir -p "$Q"
printf '%s\n' 'bash ./deploy.sh' > "$Q/$ID.cmd"
until grep -q '^exit:' "$R/$ID.log" 2>/dev/null; do sleep 3; done
cat "$R/$ID.log"
```

The daemon evaluates with **cwd = `<project>/scripts/`**, so write `bash ./X`
or `bash ../scripts/X` — `bash scripts/X` fails with 127.

Two failure modes that are worth designing against, because both produce
*wrong green results* rather than errors:

- **Two daemons for one project** (say, a LaunchAgent plus a sweep script) makes
  a job run twice, with both copies writing `>` to the same result log — what
  you read is whichever finished last. A red gate can read green. Guard with a
  single-instance lock (atomic `mkdir`) and per-job claiming.
- **Orphan cleanup killing a live job.** The subshell running a job keeps
  `runner.sh`'s argv, so a naive pattern match reaps it — every sweep chops any
  job running longer than the sweep interval (`exit=143`). Filter on `ppid` too.

A third one produces an honest error that is easy to *misfile*: a daemon
started by launchd inherits a minimal `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`)
unless the plist declares `EnvironmentVariables`. `node`, `npx` and `cargo` live
under `/usr/local/bin` or `/opt/homebrew/bin`, so a job needing them dies on its
first line with `command not found` and `exit: 127`. `runner.sh` normalizes
this at startup — it prepends `/usr/local/bin`, `/opt/homebrew/bin`,
`~/.cargo/bin` and `~/.local/bin` when they exist, prints the effective PATH in
its banner, and tags any `exit: 127` result with a line saying so. Override the
list per machine:

```sh
RUNNER_PATH_EXTRA="/opt/local/bin:/usr/local/bin" bash scripts/runner.sh <project>
```

A script that must also run outside the daemon still wants its own guard:

```sh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
command -v node >/dev/null || { echo "node not found (PATH=$PATH)" >&2; exit 127; }
```

The trap is not the failure, it is the bookkeeping: read the exit code out of
`.cmd-results/<id>.log` before recording *why* a queued job failed. A 127
(environment) written down as "the daemon rejected it" (126) sends the next
session looking at the allowlist, and the real cause survives three sessions
untouched.

If you run the sweep from launchd, note that a sweep agent will happily
**create the workspace root as an empty directory** if it is missing. `mv`-ing
a populated folder onto that empty one nests it (`projects/projects`). Before
relocating the tree, `launchctl bootout` every related agent — and remember a
`KeepAlive` agent cannot be stopped with `kill`, it just respawns.

### 7. Adopt each project

```bash
cd ~/projects/AI/<project>
bash ~/projects/AI/codetrail/template/startup.sh
```

This scaffolds `CLAUDE.md`, `PLAN.md`, `memory/active-context.md`, and
`logs/devlog.sqlite`. With `CLAUDE_PROJECTS_ROOT` set, `auto-adopt.sh` reports
unadopted folders at session start; with `CLAUDE_AUTO_ADOPT=1` it runs
`$CLAUDE_ADOPT_SCRIPT` for them without asking.

### 8. Verify the whole chain

```bash
jq '.hooks | keys' ~/.claude/settings.json
jq '.permissions' ~/projects/.claude/settings.json
jq '.mcpServers | keys' ~/projects/.mcp.json
bash ~/projects/scripts/daemon-ctl.sh list
ls ~/projects/AI/<project>/logs/devlog.sqlite
```

Then open a session in a project, edit one file, and confirm a `kind=artifact`
row landed in that project's devlog. That round-trip is the only proof the
hooks are actually firing — a registered hook that silently no-ops looks
exactly like a working one.

---

## Running several Claude accounts side by side

Three accounts on one machine, one per terminal, each with its own quota — and
a phone portal (`hub`) that can open a session on whichever account you name.
What follows is the setup as it actually runs, including the two traps that
cost real debugging time.

### 1. One config dir per account

`CLAUDE_CONFIG_DIR` selects the account. Put the aliases at the end of
`~/.zshrc`:

```sh
# acc1 = the ambient account; it uses ~/.claude and takes NO alias
alias claude2='CLAUDE_CONFIG_DIR=$HOME/.claude-acc2 claude'
alias claude3='CLAUDE_CONFIG_DIR=$HOME/.claude-acc3 claude'
alias claude-who='claude auth status --text'
```

**Do not add `claude1='CLAUDE_CONFIG_DIR=$HOME/.claude claude'`.** The first
account's token is bound to the variable being *unset*, not to that path —
`CLAUDE_CONFIG_DIR=$HOME/.claude claude auth status` reports "Not logged in"
even though it points at the default directory. Account 1 is the bare word
`claude`.

Log each one in from its own terminal, then confirm with `claude-who`.

### 2. What the secondary dirs share

In `~/.claude-acc2` and `~/.claude-acc3`, symlink back to the primary:

| Path | Treatment | Consequence |
|---|---|---|
| `skills/`, `plugins/`, `agents/` | symlink → `~/.claude/` | one copy to maintain |
| `projects/` | symlink → `~/.claude/` | **auto-memory and `--resume` history are shared by all three accounts** |
| `settings.json` | copy | hooks registered with absolute `/Users/<you>/.claude/hooks/...` paths still resolve |
| `.claude.json` | **per account, never shared** | trust dialogs and MCP approvals are account state |

Sharing `projects/` is a deliberate choice: one memory, one session history, no
matter which account did the work. Back the directory up before symlinking —
`projects.bak-<date>` next to it is enough.

Everything else loads from the cwd exactly as it does for a single account:
`CLAUDE.md` of the project and its parents, `.claude/settings*.json`,
`.claude/skills|commands|agents`, and the project's `.mcp.json`.

### 3. A separate browser per account, or OAuth logs you into the wrong one

Claude Code picks the browser for an OAuth URL in this order:
`settings.browser` → `$BROWSER` → fall back to `open`. It invokes the value as
`exec(<value>, [url])` — **one executable receiving the URL as its only
argument**. You cannot put flags in that string; they would become part of the
program name.

So point it at a wrapper. `~/bin/claude-browser-acc2.sh`:

```sh
#!/bin/sh
# Open Claude Code OAuth URLs in an isolated Chrome instance (account 2).
# --user-data-dir (not --profile-directory) is what actually allows a second
# concurrent Chrome instance on macOS with its own cookies/session.
exec open -na "Google Chrome" --args --user-data-dir="$HOME/.chrome-claude-acc2" \
  --no-first-run --no-default-browser-check "$1"
```

`chmod +x` it, and set `"browser": "/Users/<you>/bin/claude-browser-acc2.sh"`
in that account's `settings.json`. Repeat for account 3.

The `--user-data-dir` detail is the whole trick: on macOS,
`open -na "Google Chrome" --args --profile-directory=…` is silently ignored
when Chrome is already running — the args are swallowed and the URL opens in
the existing window, under whichever account is already signed in there. A
distinct user-data-dir is the only thing that yields a genuinely parallel
Chrome with separate cookies.

### 4. Turn off the auto-updater — the shared-binary EPERM trap

The aliases change only `CLAUDE_CONFIG_DIR`. All three accounts still execute
**the same binary**
(`~/.npm-global/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`).
Each account runs its own daemon, and each daemon runs its own self-upgrade —
so several processes write the same file. Type `claude2` during one of those
writes and you get:

```
error: An internal error occurred (EPERM)
```

Run it again and it works, which is exactly why the failure reads as random.
The measured signature: `~/.npm/_logs/` holding repeated
`npm install -g @anthropic-ai/claude-code@<same version already installed>`
entries — one per ~66 s — with a timestamp matching the second the error
appeared. The loop feeds itself: install → daemon sees the binary mtime change
→ restarts → decides it needs an upgrade → installs again.

The fix, right under the alias block in `~/.zshrc`:

```sh
export DISABLE_AUTOUPDATER=1
```

Upgrade by hand, with no session open: `npm i -g @anthropic-ai/claude-code`.

Sessions launched from the VS Code extension are immune — they run a different
binary under `~/.vscode/extensions/anthropic.claude-code-*/`.

One related leftover worth checking if the loop persists: an orphaned native
install under `~/.local/share/claude/versions/<old>` whose launcher
(`~/.local/bin/claude`) is gone. The daemon falls back to that old version and
logs `binary identity unresolvable … upgrade polling disabled`, i.e. it never
upgrades itself while the CLI has moved on — which is the fuel for the
reinstall loop. Rename it (`mv <old> <old>.orphan-<date>`) so the move is
reversible, and re-check `daemon.log`.

### 5. Wiring the accounts into hub

`hub` is the phone portal: you press a button in a chat and it opens a real
Claude session on this machine. It needs to know which accounts exist, so
declare them in `hub.config.json`:

```json
{
  "claude_cli": "claude",
  "claude_accounts": [
    { "name": "acc1", "launch": "claude" },
    { "name": "acc2", "config_dir": "~/.claude-acc2", "launch": "claude2" },
    { "name": "acc3", "config_dir": "~/.claude-acc3", "launch": "claude3" }
  ]
}
```

- `name` is a label for the UI — not an email, not a credential. Keep account
  emails out of this file.
- `config_dir` is optional. **The account without one is the default account**,
  selected by *not* setting the variable — the same rule as the shell.
- `launch` is the word you would type at a terminal. The default path opens a
  real Terminal window via AppleScript `do script`, i.e. an interactive zsh
  where your aliases exist, so `launch: "claude2"` works verbatim. When
  `launch` is absent, hub rebuilds the equivalent itself —
  `CLAUDE_CONFIG_DIR='<expanded config_dir>' 'claude'` — with the variable
  emitted *before* the command. An account with no `config_dir` and no `launch`
  produces a plain `claude` and no empty variable bolted on.

  The `--bg` fallback (used when the window cannot be opened) never goes
  through a shell: it spawns `claude_cli` with argv directly and sets
  `CLAUDE_CONFIG_DIR` in the child environment. An alias would be meaningless
  there — which is why the account has to be declared as a `config_dir` and not
  only as a `launch` word, if you want it to survive that fallback.

Pick an account per session with a flag: `/new -a acc2 -s dwork`. An unknown
account name is not silently coerced to the default — it logs
`account_launch_unknown`, because opening a session on the wrong account means
using the wrong quota and landing in the wrong session store, and that only
surfaces later, mid-week, when the quota runs dry.

`/accounts` lists them with current usage. The usage number comes from
`claude -p "/usage"` on a five-minute cache, which does not consume quota.

Two more settings that matter once several accounts are in play:

- `claude_transcript_root` — where `projects/<slug>/<session>.jsonl` is read
  from. Leave it empty and it resolves to `~/.claude`; that single root covers
  every account precisely because their `projects/` directories are symlinked
  together (step 2). If you ever unshare them, this must be set per account or
  hub will read one account's sessions and miss the rest.
- Sessions hub opens carry `--permission-mode auto` and `--disallowedTools`.
  The mode is there because the person who opened the session is on a phone: a
  permission dialog would appear on a screen nobody is looking at and the
  session would simply stop. The tool denials are the counterweight and must
  stay — resuming a session must never quietly grant it authority its first
  turn did not have.

---

## Rules this setup encodes for the agent

The point of the layout is that an agent working in it does not have to be
trusted to remember these — each is enforced somewhere mechanical.

| Rule | Enforced by |
|---|---|
| Secrets never reach the transcript | `cred-scrubber.sh`, `cred-pre-tool.sh`, `cred-post-tool.sh` |
| Every file edit is on the record | `devlog-artifact.sh` |
| A stale resume narrative is flagged, not trusted | `devlog-resume-check.sh` |
| Questions come after research, not instead of it | `log-source-tools.sh` + `question-discipline.sh` |
| Visual artifacts get rendered and reviewed | `rule6-visual-artifact-reminder.sh` |
| Privileged ops go through a user-owned allowlist | `.runner-allowlist` + `runner.sh` |
| The agent cannot widen its own permissions | classifier hard-deny on Claude config writes |

Three conventions the mechanism cannot enforce, which therefore belong in
`CLAUDE.md` where they are read every turn:

- **One session, one project.** Switching mid-session is how a write lands in
  the wrong nested repo.
- **Verification runs on the real thing.** A green test suite is a necessary
  condition, not the acceptance step; business data used to accept a feature
  comes through the real UI flow, not a direct API insert that skips the
  validation, permission, and navigation layers where things actually break.
- **Exit codes get read directly.** Piping a test run through `tail` swallows
  the failure; the exit code of something that merely *launches* a background
  job says the fork succeeded, nothing more.
- **Deliverables stay in the tree.** A report, dashboard, or diagram is written
  into the project and handed back as a path — not published to an external
  service and not answered with a hosted link. Anything outside the tree does
  not travel with git and cannot be found by the next session.
- **A blocked command gets re-formed, not retried.** An LLM `PreToolUse`
  reviewer is non-deterministic and its BLOCK ends the whole turn. Resend the
  command explicitly with its safety properties spelled out in `description`,
  cap it at two attempts, then hand it to the user.

---

## Opt-in env vars

| Var | Purpose | Default |
|-----|---------|---------|
| `CODETRAIL_HOME` | Path to this repo. `runner-ensure.sh` uses it to find `scripts/daemon-ctl.sh`. | unset (hook inert) |
| `CLAUDE_PROJECTS_ROOT` | Parent folder containing your projects. `auto-adopt.sh` is a silent no-op when unset. | unset (hook inert) |
| `CLAUDE_ADOPT_SCRIPT` | Absolute path to `<codetrail>/template/startup.sh`. Used by `auto-adopt.sh` when `CLAUDE_AUTO_ADOPT=1`. | unset |
| `CLAUDE_AUTO_ADOPT` | `1` to auto-scaffold unadopted folders without asking. | `0` (inform only) |
| `CRED_SCRUB_TOOL_BLOCK` | `1` to make `cred-post-tool.sh` hard-block on cred-leak instead of warn. | `0` (warn only) |

## Privacy / safety notes

- **No literal secret values are logged.** `~/.claude/cred-block.log` is JSONL
  with timestamps, session IDs, placeholder names, categories, and lengths. The
  real value only lives in the per-session vault file at
  `~/.claude/vault/<session>.json` (chmod 600).
- **Vault is per-session, not per-project.** A vault file is created the first
  time `cred-scrubber.sh` or `cred-post-tool.sh` allocates a placeholder. Old
  session files don't expire automatically — delete manually if you want them
  gone.
- **`cred-pre-tool.sh` is the only hook that can block tool execution
  outright.** `cred-post-tool.sh` warns by default; flip the env var if you want
  it to block.
- **`question-discipline.sh` exit code 2 is a non-blocking reminder** — Claude
  sees it as transcript feedback, the turn is not retried.

## Uninstall

There's no uninstall script. To remove:

1. Delete the relevant entries from `~/.claude/settings.json` under `.hooks`.
   (You can keep the hook files in `~/.claude/hooks/`; they only fire when
   registered.) Back the file up first — the hook block is long, and rebuilding
   it by hand is worse than restoring it.
2. Optionally remove the hook files themselves with
   `rm ~/.claude/hooks/{cred-,vault-,log-source,question-,rule6-,auto-adopt,devlog-,runner-}*.sh`.
3. `disableAllHooks: true` in settings turns every hook off without deleting
   anything — the better first move when you are diagnosing rather than
   removing.

## Hook schema reference

These hooks follow the Claude Code hook contract documented at the `hooks` key
of `~/.claude/settings.json`. Each hook reads a single JSON object from stdin
and may print a single JSON object to stdout (typed by event). Failures should
`exit 0` whenever possible — never block tools on a hook bug. The cred-* hooks
are the exceptions: they intentionally fail-closed on vault errors.

A hook edited while a session is open may not be picked up: the settings watcher
only watches directories that already held a settings file when the session
started. If a freshly registered hook does not fire, open `/hooks` once or
restart the session before assuming the hook itself is broken.
