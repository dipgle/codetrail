# Codetrail Claude Code Hooks

User-level hooks that back the [template/CLAUDE.md](../template/CLAUDE.md)
HARD RULES with real enforcement. The CLAUDE.md rules are text the model
reads and self-applies; these hooks are bash scripts the Claude Code
harness runs **outside** the model's control — they redact, deny, audit,
and remind without depending on the model's discipline.

## What's here

| File | Event | What it does |
|------|-------|--------------|
| `cred-scrubber.sh` | `UserPromptSubmit` | Detect cred-shaped literals in your prompt → allocate stable `<cred-N>` placeholder → store real value in `~/.claude/vault/<session>.json` (chmod 600). Warns the model to refer by placeholder. |
| `cred-pre-tool.sh` | `PreToolUse` (`Read\|Bash`) | Deny tool calls that try to read known secret paths (`.env`, `id_rsa`, `~/.aws/credentials`, `*.pem`, etc.). Allow `.env.example`, `id_rsa.pub`, write/move/list ops. |
| `cred-post-tool.sh` | `PostToolUse` (`Read\|Bash\|Grep\|mcp__`) | Backstop: scan tool output for cred shapes. Vault the value, append audit log, warn the model not to echo. Set `CRED_SCRUB_TOOL_BLOCK=1` to escalate to hard block. |
| `vault-get.sh` | helper (not registered) | Resolve `<cred-N>` → real value at shell exec time. Use in Bash like `pass="$(vault-get.sh <session> cred-1)"`. |
| `auto-adopt.sh` | `SessionStart` (`startup`) | Detect unadopted folders under `$CLAUDE_PROJECTS_ROOT`. Inform Claude (or auto-scaffold via `$CLAUDE_ADOPT_SCRIPT` if `CLAUDE_AUTO_ADOPT=1`). |
| `devlog-resume-check.sh` | `SessionStart` (`startup`) | Compare newest file mtime against last devlog event. If gap > 1h, warn that resume narrative is likely stale. |
| `devlog-artifact.sh` | `PostToolUse` (`Edit\|Write\|NotebookEdit`) | Walk up from edited file → log `kind=artifact` event into the nearest `logs/devlog.sqlite`. Removes the "remember to log" burden. |
| `log-source-tools.sh` | `PostToolUse` (`WebFetch\|WebSearch\|ReadMcpResourceTool`) | Append each external lookup to `~/.claude/source-log.jsonl`. Feeds `question-discipline.sh`. |
| `question-discipline.sh` | `Stop` | If last assistant turn ended with a question and no `kind=source` event in devlog or source-log in last 30 min → emit `QUESTION_DISCIPLINE_VIOLATION` reminder. |
| `rule6-visual-artifact-reminder.sh` | `PostToolUse` (`Edit\|Write\|NotebookEdit`) | When edited file is `.svg/.html/.png/.d2/.mmd/...`, print HARD RULE #6 render-and-audit reminder to transcript. |

## Install

```bash
bash hooks/install.sh
# or, to preview without changing anything:
bash hooks/install.sh --dry-run
```

The installer:
1. Copies each hook to `~/.claude/hooks/` (chmod +x).
2. Merges hook registrations into `~/.claude/settings.json` — preserves
   all existing keys (permissions, theme, env, etc.) and dedupes by
   command path, so re-running is a no-op.

After install, reload Claude Code (Cmd+Shift+P → Developer: Reload
Window in VS Code) so the new hook entries take effect.

## Opt-in env vars

| Var | Purpose | Default |
|-----|---------|---------|
| `CLAUDE_PROJECTS_ROOT` | Parent folder containing your projects. `auto-adopt.sh` is a silent no-op when unset. | unset (hook inert) |
| `CLAUDE_ADOPT_SCRIPT` | Absolute path to `<codetrail>/template/startup.sh`. Used by `auto-adopt.sh` when `CLAUDE_AUTO_ADOPT=1`. | unset |
| `CLAUDE_AUTO_ADOPT` | `1` to auto-scaffold unadopted folders without asking. | `0` (inform only) |
| `CRED_SCRUB_TOOL_BLOCK` | `1` to make `cred-post-tool.sh` hard-block on cred-leak instead of warn. | `0` (warn only) |

## Privacy / safety notes

- **No literal secret values are logged.** `~/.claude/cred-block.log` is
  JSONL with timestamps, session IDs, placeholder names, categories, and
  lengths. The real value only lives in the per-session vault file at
  `~/.claude/vault/<session>.json` (chmod 600).
- **Vault is per-session, not per-project.** A vault file is created the
  first time `cred-scrubber.sh` or `cred-post-tool.sh` allocates a
  placeholder. Old session files don't expire automatically — delete
  manually if you want them gone.
- **`cred-pre-tool.sh` is the only hook that can block tool execution
  outright.** `cred-post-tool.sh` warns by default; flip the env var if
  you want it to block.
- **`question-discipline.sh` exit code 2 is a non-blocking reminder** —
  Claude sees it as transcript feedback, the turn is not retried.

## Uninstall

There's no uninstall script. To remove:

1. Delete the relevant entries from `~/.claude/settings.json` under
   `.hooks`. (You can keep the hook files in `~/.claude/hooks/`; they
   only fire when registered.)
2. Optionally remove the hook files themselves with
   `rm ~/.claude/hooks/{cred-,vault-,log-source,question-,rule6-,auto-adopt,devlog-}*.sh`.

## Hook schema reference

These hooks follow the Claude Code hook contract documented at the
`hooks` key of `~/.claude/settings.json`. Each hook reads a single JSON
object from stdin and may print a single JSON object to stdout (typed by
event). Failures should `exit 0` whenever possible — never block tools
on a hook bug. The cred-* hooks are the exceptions: they intentionally
fail-closed on vault errors.
