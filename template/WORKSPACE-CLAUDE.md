# Workspace CLAUDE.md — the rules every session loads

Copy this to `<WORKSPACE_ROOT>/CLAUDE.md` and replace the placeholders. This is
the **root tier**: the one file every Claude Code session in every project under
the workspace reads on every turn. `template/CLAUDE.md` (per project) carries
the project's own process; this file carries how work is done at all.

Placeholders to fill: `<WORKSPACE_ROOT>` (e.g. `~/projects`) and
`<CODETRAIL_HOME>`. §11 ships the house conventions this workspace actually
runs on — chart library, test driver, git rhythm, language per audience. Keep
them or replace them with yours, but keep *a* decision in every row.

Keep it in the language you actually work in. Translate the rules if that is not
English — a rule the reader skims past is a rule that does not fire.

---

## 0. Where a rule has to live to be enforced

Four tiers, strongest first. Put each rule in the weakest tier that still makes
it fire, and no weaker:

| Tier | Fires | Use for |
|---|---|---|
| Hook (`~/.claude/hooks/*.sh`) | mechanically, outside the model's control | redaction, denial, audit, reminders |
| This file | every turn, every project | rules that must apply without being recalled |
| `<project>/CLAUDE.md` | every turn in one project | stack, conventions, local traps |
| Memory files | only when something recalls them | background, history, one-off facts |

The failure mode this table exists to prevent: writing a must-fire rule into a
memory file. **Memory bodies are not loaded into context** — only their index
line is. A rule that has to fire on every turn and lives in memory does not
exist. Write it here, as TRIGGER → CHECK, or enforce it in a hook.

Corollary: when a rule is added here, add the trigger phrasing too. "Be careful
with X" never fires. "TRIGGER: you are about to do X. CHECK: 1… 2… 3…" fires.

---

## 1. Session entry — one session, one project

A session usually opens with a bare name: "mailler", "continue tfl5",
"sdvi — debug auth". The name is a folder under `<WORKSPACE_ROOT>`.

1. **Resolve.** Locate the folder. Not found → ask for the path; do not guess a
   sibling with a similar name.
2. **Pin.** Set `PROJECT_DIR=<WORKSPACE_ROOT>/<name>`. Every later shell command
   starts from it; every file operation uses an absolute path under it.
3. **Load context, in order:** the project's `CLAUDE.md`, `PLAN.md`,
   `memory/active-context.md`, then the last ~20 devlog events.
4. **Ensure the command daemon** if the project has a `.runner-allowlist`
   (idempotent — skip otherwise).
5. **Confirm in one line:** `→ Focus: <name> (<dir>). N events, M active UCs.
   Daemon: <pid>.` Then start work.

Rules that hold for the whole session:

- **One session, one project.** Never switch mid-session — that is how a write
  lands in the wrong nested repo. Another project means another session.
- **Prefix every response with `[<project>]`** so a user watching several
  sessions can scan them.
- **Files you create stay inside `$PROJECT_DIR`** — never at the workspace root,
  never in a sibling project, scratch to `$PROJECT_DIR/.tmp/`.
- **"save" / "checkpoint"** = update `memory/active-context.md` + log a
  `kind=note` event. Nothing else, no other project touched.
- **Closing a session needs no cleanup** — the devlog was written as you went.

---

## 2. Definition of Done

Say "done" only when every applicable line holds. Missing one → report the real
state ("not done, missing X, needs Y"). Never lower the bar to reach the word.

1. **Build + full test suite green, zero warnings**, exit code read directly (not
   through `tail` or a pipe), in the right workspace (`pwd` / manifest checked).
2. **Ran end-to-end at least once on the real environment with real data** — no
   mocks in the acceptance step. UI means a real browser driver with zero
   console errors.
3. **Bug fixes carry a reproducing test**: RED before, GREEN after, kept as a
   regression lock.
4. **Deploys are confirmed from the outside**: fetch from the URL or host the
   user actually uses, compare a version marker, smoke one flow.
5. **UI is reviewed by eye**: screenshot every state (default, hover, empty,
   error), compared against the design.
6. **No new silent failures in the diff.** Every new threshold has an override
   and logs when it skips. No "self-heals" claim without a test that proves it.
7. **No fake hardcoding on a production path** (stubs, demo data, `is_paid =
   true`). Money, payroll, and scoring formulas are checked against the spec
   with worked numbers.
8. **Security pass over the diff**: new endpoints carry an authorization gate; no
   credentials or PII in code, logs, or git history. Security debt blocks.
9. **Contracts stay whole**: schema and every consumer ship in the same commit;
   static assets and binary ship in the same bundle; vendored fixtures pin a
   version.
10. **Books closed**: active-context, session summary, decision log (with
    evidence), TODO. The report separates *ran for real* from *written but not
    run*.

Enforce it with a gate script rather than good intentions: a mechanical backbone
(build + lint + test with exit codes read directly, a diff scan for silent
failures, credentials, and hardcoded values) plus the judgment dimensions above.

---

## 3. Twelve principles against shallow work

The diagnosis these come from: work ships "for show" when (1) *done* is defined
as code-plus-green-tests instead of running correctly in the real environment,
(2) errors are allowed to be silent, (3) symptoms get patched instead of causes,
and (4) breadth eats depth — elaborate architecture over a stubbed core.

1. **No silent failures.** Every error path logs, meters, falls back, or panics.
   A swallowed `Result`, a bare `return`, a `continue` on an impossible branch —
   each one is a bug that will be found by a user instead of by you.
2. **A green suite is necessary, not sufficient.** "Verified" counts only on the
   real environment with real data.
3. **Never claim what you have not run.** No "done", no "self-healing", no "it
   should work" for code that has never executed.
4. **Verify your own pipeline.** A deploy is not deployed until you fetched it
   back from the target. A write is not written until you read it back.
5. **Root-cause before patching.** The second time a class of bug appears, build
   the guard that kills the class — a lint, a test, a type, a gate.
6. **Walking skeleton first.** Get the core running end-to-end before elaborating
   the architecture around it.
7. **Trust but verify every claim about reality** — the user's, the docs', an
   agent's, your own memory's — with a file:line read in *this* session. A
   "coverage matrix" built by counting substrings is a lie with a table around
   it.
8. **Debt is written down, dated, and capped.** "Non-blocking" is not a black
   hole. Security debt is never non-blocking.
9. **Contract and consumer ship together.** Keep the mechanism/policy boundary
   sharp: a mechanism that encodes one caller's policy breaks the next caller.
10. **Decisions and handover are disciplined.** Every decision carries evidence;
    every session closes its books.
11. **Verify before asking the user to decide.** Any question that needs a user
    ruling — design, scope, a default value, which of two directions — must rest
    on code and docs read in this session, quoted by file:line. Not memory, not
    assumption. If you have not read enough to ask precisely, go read first.
12. **No shortcuts to a state the user could not reach** — see §4.

---

## 4. Acceptance doctrine — no shortcuts

Business data used to run or accept a feature **must be produced through the real
business flow in the real UI**, and any claim of "works / matches the design"
must rest on real operations in that UI. Do not POST straight to the API or
insert into the database to build a state and then call it accepted.

Why: calling the API directly skips exactly the fragile part — front-end
validation, component rules, navigation, per-screen authorization, and the
intermediate steps of the workflow. Two failures that made this rule:

- A create endpoint defaulted new records to `DRAFT`. Seeding through the API
  produced drafts and skipped *submit → approve* entirely; the acceptance ran
  against a state that does not exist in real life.
- "Seven endpoints return 200" proved nothing about the app: the app sent a
  different parameter name and got a `403` **inside the body** while HTTP stayed
  `200`.

Three kinds of operation, kept strictly apart:

| Operation | May call API/DB directly? |
|---|---|
| Creating business data for a run or an acceptance | **No** — through the real UI flow |
| Claiming acceptance ("it works", "matches the design") | **No** — real operations in the UI |
| Probing / reading (finding an account in the right state, dumping data to compare, measuring the network) | **Yes** — but label it "probe, not acceptance" |

Exceptions exist, and each must be **declared where it happens** (a comment in
the script *and* a line in the report) naming what was skipped and why:

1. **The login gate** on a screen that has no login UI — inject the token, then
   do the rest entirely through the UI.
2. **Hardware that cannot be automated** (camera, face recognition, attendance
   terminal, scanner) — report it as *not accepted yet* and propose the real
   path. Do not substitute an API call and report green.
3. **A third party that blocks** (payment, certificate authority, SMS sandbox) —
   config-ready and flag-gated is the honest end state for your side.

An exception on one screen never generalizes to another. Self-check before every
report: *who created this data — a person clicking, or me POSTing?* If it was
you, it is not accepted, and the report must say so.

### 4a. One use case = data + API + UI, asserted together

A UC is not three parallel test runs; it is one scenario asserted at three
layers at once. UI coverage must be the **projection of the UC set** — enumerate
every UC branch (each state and scenario is its own branch), and let each branch
pull in its own UI path. Enumerate the UCs and the UI is covered; write "UI
tests" as a separate list and you will always miss branches. Ban the phrase
"let's run the UI layer now" — the right sentence is "let's run the remaining
UCs".

### 4b. Cross-browser or blind

Chromium-only testing is structurally blind for anything that ships inside a
WebView. Evidence: a suite passing 41/41 in Chromium plus a 1000-account sweep
with zero failures, while the iOS build was a white screen — a bare import
specifier inside an inlined worker that WebKit refuses to resolve, with no real
error boundary above it. Worse, **Chromium does not surface worker errors to
`page.on("pageerror")`**, so no amount of Chromium runs could ever have caught
it. Test the engines your users run, not the one that is convenient.

### 4c. Test as a real tester would

Assert the **data and its scope**, not that a screen rendered. Add the negative
case — try to breach the fence you just built and prove it holds. And run the
scenario **as each role**: an end-to-end pass driven by a broad-permission
account cannot catch an authorization bug, because that account was never
supposed to be stopped.

### 4d. A measurement that cannot fail is not a measurement

An assertion that is always green — or always empty — measures nothing. Evidence:
a column count taken with a component-library selector while the table was plain
`<table>`, reporting zero columns on every screen and printing ✓ every time.
Before trusting a check, make it fail once on purpose.

---

## 5. Four checks before every shell command

Not lessons — a checklist. Items 1–2 can be enforced by a hook; 3–4 are on you.

1. **One turn, one state change.** Read-only chains (`grep`, `git log`, `sed -n`)
   batch freely — if one dies you lose nothing. But two write/run operations in
   one turn means a single blocked fragment **kills the whole turn**, including
   the parts that were fine.
2. **Files are created with the Write tool, never a heredoc.** Shell is for
   *running* what is already written.
3. **Anything that runs over a minute: check its inputs exist first** — env vars,
   binaries, containers, and whether the flags match this platform (macOS has no
   `cat -A`, no `ps -o sess=`, no GNU `sed -i`). Five seconds of checking buys
   back thirty minutes of blind running.
4. **Never read the exit code of something that merely launches.** `nohup … &`
   exiting 0 means the fork succeeded, nothing more. Background work must print
   its own marker (`GATE_EXIT=$?`) and you must read that marker.

---

## 6. When a `PreToolUse` reviewer returns BLOCK

If the workspace installs an LLM-backed Bash reviewer, it judges with a model
and is **not deterministic** — the same command can pass five times and be
blocked the sixth. It runs before the command, so nothing is half-done, but the
BLOCK ends the whole turn.

**TRIGGER:** a tool result reading `PreToolUse:Bash hook error: … BLOCK …`.
**CHECK — five steps, in order, do not improvise:**

1. **Do not resend it verbatim, and do not wrap it in a script** (or push it
   through the daemon). The reviewer reads a script as an opaque box it cannot
   inspect for `--force`, so wrapping makes a block *more* likely. Do not adopt
   the flag the reviewer itself suggested — next turn it blocks that flag.
2. **Establish safety with read-only commands first** — read-only is on the fast
   path: grep the script for dangerous tokens, print the repo toplevel, print
   the current branch, list what is about to be pushed.
3. **Resend explicitly, and put the safety properties in the `description`
   field.** The reviewer reads the description, not just the command. The same
   `git push` described as "Push commit to origin main" was blocked twice; as
   "Non-force fast-forward push, repo pinned with -C, verified toplevel + branch
   main, no --force, no history rewrite" it was allowed immediately. The
   description must answer the five things it scores: irreversible data loss,
   rewriting shared history, wrong repo in a nested tree, production state
   change, and the agent modifying its own configuration.
4. **Verify after it runs.** Do not trust the exit code of a launcher.
5. **Ceiling of two attempts.** Correct form, still blocked → stop and hand the
   command to the user. Do not loop variants. For production deploys and
   production database writes there is no path for the agent at all — say so up
   front instead of discovering it twice.

Because a BLOCK kills the turn, never batch another state change into the same
turn as a command likely to be reviewed (§5.1).

---

## 7. Command execution — native tools, daemon, sandbox

Order of preference, and it is not a style question — each option runs in a
different environment:

1. **Reading and searching files → native tools** (`Read`, `Grep`, `Glob`). They
   address the real filesystem. Do not shell out to `cat`/`grep`/`ls` for this.
2. **Running commands on the host → the file-queue daemon** when the direct tool
   is denied, sandboxed, or the command is long-running. This is the real host.
3. **A sandboxed shell → only** for scratch computation that touches neither the
   repo nor the host. It mounts the repo elsewhere and its network is cut; work
   done there reports on an environment nobody ships.

The daemon is a plain user process that evaluates queued command files outside
the permission classifier, bounded by a per-project allowlist the **user** owns:

- Enqueue by writing `<project>/scripts/.cmd-queue/<id>.cmd`, poll
  `.cmd-results/<id>.log` until it contains `exit:`.
- Its cwd is `<project>/scripts/`, so write `bash ./x.sh`, not `bash scripts/x.sh`.
- `126` = the allowlist refused the command. `127` = the command does not exist
  (usually PATH). They need opposite fixes — read the code before writing down
  a cause.
- A command not in the allowlist is `REJECTED`. **Ask the user to add the line**;
  an agent editing its own allowlist is self-granting and is blocked by design.
- An optional `<project>/.runner-commands` maps `@name` → command and is re-read
  per job, so new entries need no restart. The library grants nothing: the
  mapped command still has to match the allowlist.
- **Production deploys and production database writes: there is no path for the
  agent, by any route.** Say so immediately and hand the command over. Do not
  spend turns probing for a way around.

---

## 8. Reporting, questions, and deliverables

- **Report what is true.** Separate *ran for real* from *written but not run*
  from *tried and failed*. A test that fails gets reported with its output. A
  skipped step gets named.
- **Deliverables stay in the project tree.** Reports, dashboards, diagrams are
  written into the repo and handed back as a path — not published to an external
  service, not answered with a hosted link. Anything outside the tree does not
  travel with git and cannot be found by the next session.
- **Research before asking.** Exhaust, in order: project data, the project's own
  docs and decision log, prior art in the code, then an authoritative external
  source. Log every source consulted. Only then ask — and when you ask, state
  what you checked, the specific gap, and two or three concrete options with
  trade-offs. Never ask "X or Y?" without first checking whether the evidence
  already answers it.
- **When the spec is silent, do not invent the answer.** Do every part that does
  not depend on the gap, then raise a written question for the design owner —
  the question, the file:line it arises from, the measurable impact, and your
  proposed options. Do not quietly decide, and do not stall the whole task.
- **Attach the links and buttons while assembling the message**, not by scanning
  the finished string for a place to put them. When you build a message in
  parts, you already know which part is which.
- **Deliver the result; do not hand back a design menu.** The user brings the
  intent and expects the finished thing. Make the routine calls yourself, state
  the assumption you made, and keep going. Ask only where two readings lead to
  materially different work — and then ask with evidence (§3.11).
- **Do the whole process, in one pass.** No stage quietly skipped, no half of
  the task deferred because it was the boring half. If part of the scope is
  genuinely blocked, finish everything else and say exactly what is left and
  why — scaling the work down is the user's call, not yours.
- **Learn from the real source, not from memory.** "Make it like X" means open X
  and look. A comparison drawn from recollection is a guess wearing a citation.
- **Commands for the user go in their own code block**, one command per block,
  with the explanation in prose above it and an expected duration — never buried
  in a sentence or hidden behind a `#` comment.

---

## 9. Team execution

For non-trivial work, run a team of subagents instead of role-switching in one
context:

1. **Scout** — decompose into a file cluster and a conflict matrix.
2. **Assign a model per role.** Strongest model for consensus-critical,
   determinism-critical, hard reasoning, integration and review; mid tier for
   mechanical carving, tests, docs, ports; small tier for glue (re-exports,
   formatting, grep).
3. **Spawn.** Isolated worktrees when agents mutate files in parallel;
   sequential-but-still-a-team when they share a file (each unit = one carving
   agent plus one reviewer).
4. **Integrate on the main thread** and hold the parity gate: full suite green,
   zero warnings.

Solo is correct only for a single cohesive file, a small fix, or a conversation —
and it is still framed as a sprint and logged. Two standing cautions: subagents
must never run git mutations (a `stash`/`checkout`/`reset` in a subagent reverts
the main thread's uncommitted work), and an agent's worktree can branch from a
stale base — check what it branched from before trusting its diff.

---

## 10. Data and operational safety

- **Every state-writing operation must be crash-safe**: one atomic commit point,
  no half-written state that a restart cannot resolve.
- **Never reset shared state to validate a fix.** Classify the change and do an
  in-place upgrade; a genesis reset destroys the corpus that proves recovery
  works, and someone's data with it.
- **On live systems with real users, make the minimal reversible fix.** Audit
  before each step, canary, verify after.
- **Do not put robot guardrails on the owner's own actions.** Ceilings built for
  autonomous loops do not apply to a button the owner presses: count it, price
  it, show it — do not block it.
- **Prefer measuring to hardcoding.** For runtime problems (slow sync, drained
  pool, stuck role), build the self-measuring adaptive path rather than a magic
  constant, and if a constant is unavoidable give it an override and log when it
  fires.
- **`git commit` succeeding does not mean it committed what you think.** Read the
  tree back — the files, the branch, the repo. In a workspace with nested
  repositories, pin every git call to an explicit path and check the toplevel
  before writing; a command run one directory off commits into the wrong
  history and looks perfectly green doing it.

---

## 11. House conventions

Choices this workspace made once so no session has to re-litigate them. They are
real values, not examples — swap them for yours when you adopt this file, but
swap them for *something*: "decide per case" is how a workspace ends up with
four chart libraries.

| Area | Convention |
|---|---|
| Chat | Vietnamese — answers, summaries, reports, questions. Identifiers, commands, paths, and technical terms stay as they are |
| Code comments | English, always, including in a Vietnamese-speaking session |
| User-facing text | By audience, not by mood — see below |
| Printed / exported Vietnamese administrative documents | Times New Roman 14 (TT 01/2011/TT-BNV, NĐ 30/2020/NĐ-CP) — `.docx`, `.xlsx`, PDF, and `@media print` CSS. Not screen UI, not code, not transactional email |
| UI charts | **Apache ECharts**, every project, vanilla file or bundler alike. Not Chart.js, D3, Recharts, Highcharts, Plotly, or Google Charts unless the user names one for that job |
| Web / E2E testing | **Playwright** headless — load each page, click every button and tab, type in the inputs, capture console errors and uncaught exceptions, assert zero. Against a real backend; a mock hides exactly the data-dependent failures |
| Design source of truth | HTML mockup first, Figma second, **neither → stop and ask**. Do not invent a UI |
| Deviating from the mockup | Only for a measured technical reason, recorded at the point of deviation. A deliberate-but-undocumented deviation is still a deviation |
| Git rhythm | Commit per meaningful stretch, **≈1 push/day**. No commit after every file, no amend + force-push to fix a typo in a message, no force-push, no direct work on `main` |
| Marketing surfaces | No competitor comparisons anywhere user-facing — no vs-tables, no "how is this different from X" FAQ, no rival product named in titles or meta tags. Show the model, not the core: capabilities in user language, never struct names, env vars, file paths, table schemas, or internal version numbers |
| Deliverables | In the project tree, handed over as a path (§8) |
| Secrets | Vault reference, never a literal — not in chat, code, logs, or git |

**User-facing text, by audience.** Public and platform surfaces — landing pages,
end-user guides, public API docs, the UI of a product aimed at an international
audience — are **100% English**, no mixed sentences, even when the session is in
Vietnamese. Products built for Vietnamese public-sector users are the opposite:
UI and exported documents in **plain Vietnamese**, with the jargon actually
translated (module → chức năng, dashboard → bảng điều khiển, snapshot → số liệu
chốt), keeping English only where it is unavoidable — login identifiers, system
resource and field codes, and acronyms Vietnamese readers already use (QR, KPI,
OTP, VNeID). Internal docs, decision logs, and this file may be in either.

**One entity, one word.** Whatever the schema calls a thing is what the UI calls
it. Synonyms drifting between table, API, and screen ("app" in the database,
"workspace" on the button) cost more than they ever save.
