#!/usr/bin/env node
// project-agent MCP server (TypeScript port).
// API parity with project-agent-rs. Modes:
//   - Workspace mode: PROJECT_LOG_DIR / PROJECT_MEMORY_DIR set
//   - Router mode:    PROJECTS_ROOT set, PROJECT_LOG_DIR not set → tools require `project` arg
//   - Workspace + cross-project: both PROJECTS_ROOT and PROJECT_LOG_DIR set →
//     own devlog as default, but inbox tools can resolve other projects under PROJECTS_ROOT/AI/

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Devlog } from "./devlog.js";

// --- State -----------------------------------------------------------------

class State {
  readonly routerMode: boolean;
  readonly projectsRoot: string | null;
  readonly defaultDevlog: Devlog | null;
  private cache = new Map<string, Devlog>();
  readonly memoryDir: string;
  readonly currentProject: string | null;

  constructor() {
    const root = process.env.PROJECTS_ROOT;
    this.projectsRoot = root ? resolve(root) : null;

    const logEnv = process.env.PROJECT_LOG_DIR;
    const memEnv = process.env.PROJECT_MEMORY_DIR;
    this.memoryDir = memEnv ? resolve(memEnv) : join(process.cwd(), "memory");

    // Router mode = PROJECTS_ROOT set AND no project-scoped log dir.
    // If both are set we're in workspace+cross-project: own devlog as default,
    // inbox tools can still reach other projects via projectsRoot.
    this.routerMode = this.projectsRoot !== null && !logEnv;

    if (this.routerMode) {
      this.defaultDevlog = null;
    } else {
      const logDir = logEnv
        ? resolve(logEnv)
        : join(dirname(this.memoryDir), "logs");
      this.defaultDevlog = new Devlog(join(logDir, "devlog.sqlite"));
    }

    this.currentProject =
      process.env.CODETRAIL_PROJECT ??
      this.deriveProjectName(this.memoryDir, this.projectsRoot);
  }

  private deriveProjectName(
    memoryDir: string,
    projectsRoot: string | null
  ): string | null {
    // Convention: <root>/AI/<project>/memory or <root>/<project>/memory.
    const parts = memoryDir.split(/[\\/]/).filter(Boolean);
    const aiIdx = parts.findIndex(
      (p, i) => p === "AI" && i + 1 < parts.length
    );
    if (aiIdx >= 0) return parts[aiIdx + 1] ?? null;
    // Fallback: parent of memory dir basename
    if (parts.length >= 2 && parts[parts.length - 1] === "memory") {
      return parts[parts.length - 2] ?? null;
    }
    return null;
  }

  resolveExternalDevlog(project: string): Devlog {
    if (!this.projectsRoot) {
      throw new Error(
        "Cross-project messaging requires PROJECTS_ROOT env to be set"
      );
    }
    const cached = this.cache.get(project);
    if (cached) return cached;
    const candidates = [
      join(this.projectsRoot, "AI", project),
      join(this.projectsRoot, project),
    ];
    const projectDir = candidates.find((d) => existsSync(d));
    if (!projectDir) {
      throw new Error(
        `Project '${project}' not found under ${this.projectsRoot}/AI/ or ${this.projectsRoot}/`
      );
    }
    const db = join(projectDir, "logs", "devlog.sqlite");
    if (!existsSync(db)) {
      throw new Error(
        `Project '${project}' has no devlog at ${db}. Run 'adopt' first.`
      );
    }
    const dv = new Devlog(db);
    this.cache.set(project, dv);
    return dv;
  }

  // Resolve devlog for inbox tools: explicit project param > current project's own devlog.
  resolveInboxDevlog(project: string | undefined): Devlog {
    if (project && project !== this.currentProject) {
      return this.resolveExternalDevlog(project);
    }
    if (this.defaultDevlog) return this.defaultDevlog;
    if (project) return this.resolveExternalDevlog(project);
    throw new Error(
      "No project specified and no default devlog (running in pure router mode without project arg)"
    );
  }

  resolveDevlog(project: string | undefined): Devlog {
    if (!this.routerMode) {
      if (!this.defaultDevlog) throw new Error("default devlog not initialized");
      return this.defaultDevlog;
    }
    if (!project) {
      throw new Error("router mode requires 'project' argument");
    }
    const cached = this.cache.get(project);
    if (cached) return cached;

    const root = this.projectsRoot!;
    const candidates = [join(root, "AI", project), join(root, project)];
    const projectDir = candidates.find((d) => existsSync(d));
    if (!projectDir) {
      throw new Error(
        `Project '${project}' not found under ${root}/AI/ or ${root}/`
      );
    }
    const db = join(projectDir, "logs", "devlog.sqlite");
    if (!existsSync(db)) {
      throw new Error(
        `Project '${project}' has no devlog at ${db}. Run 'adopt' first.`
      );
    }
    const dv = new Devlog(db);
    this.cache.set(project, dv);
    return dv;
  }

  listProjects(): Array<{ name: string; path: string; adopted: true }> {
    if (!this.routerMode) {
      throw new Error(
        "list_projects only available in router mode (set PROJECTS_ROOT)"
      );
    }
    const aiDir = join(this.projectsRoot!, "AI");
    if (!existsSync(aiDir)) return [];
    const result: Array<{ name: string; path: string; adopted: true }> = [];
    for (const name of readdirSync(aiDir)) {
      const projectDir = join(aiDir, name);
      let isDir = false;
      try {
        isDir = statSync(projectDir).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      const db = join(projectDir, "logs", "devlog.sqlite");
      if (existsSync(db)) {
        result.push({ name, path: projectDir, adopted: true });
      }
    }
    return result;
  }
}

// --- Helpers --------------------------------------------------------------

const state = new State();

function textResult(payload: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

function errResult(e: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
    isError: true,
  };
}

// --- Server ---------------------------------------------------------------

const server = new McpServer({
  name: "project-agent",
  version: "0.1.0",
});

// --- Devlog tools (both modes) -------------------------------------------

server.registerTool(
  "log_event",
  {
    description:
      "Append a row to devlog.sqlite. kinds: message|decision|action|artifact|answer|source|note. In router mode pass `project` (folder name under PROJECTS_ROOT/AI/).",
    inputSchema: {
      project: z.string().optional(),
      kind: z.string(),
      actor: z.string().optional(),
      refType: z.string().optional(),
      refId: z.string().optional(),
      content: z.string().optional(),
    },
  },
  async ({ project, kind, actor, refType, refId, content }) => {
    try {
      const dv = state.resolveDevlog(project);
      const id = dv.logEvent(
        kind,
        actor ?? null,
        refType ?? null,
        refId ?? null,
        content ?? null
      );
      return textResult({ id });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "create_use_case",
  {
    description: "Create or update a use case (UC-xxx). Upserts by id.",
    inputSchema: {
      project: z.string().optional(),
      id: z.string(),
      title: z.string(),
      actor: z.string().optional(),
      preconditions: z.string().optional(),
      mainFlow: z.string().optional(),
      altFlow: z.string().optional(),
      status: z.string().optional(),
    },
  },
  async ({
    project,
    id,
    title,
    actor,
    preconditions,
    mainFlow,
    altFlow,
    status,
  }) => {
    try {
      const dv = state.resolveDevlog(project);
      const result = dv.upsertUseCase(
        id,
        title,
        actor ?? null,
        preconditions ?? null,
        mainFlow ?? null,
        altFlow ?? null,
        status ?? "draft"
      );
      return textResult({ id: result });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "create_test_case",
  {
    description: "Create or update a test case (TC-xxx) linked to a use case.",
    inputSchema: {
      project: z.string().optional(),
      id: z.string(),
      useCaseId: z.string(),
      title: z.string(),
      steps: z.string().optional(),
      expected: z.string().optional(),
      status: z.string().optional(),
    },
  },
  async ({ project, id, useCaseId, title, steps, expected, status }) => {
    try {
      const dv = state.resolveDevlog(project);
      const result = dv.upsertTestCase(
        id,
        useCaseId,
        title,
        steps ?? null,
        expected ?? null,
        status ?? "pending"
      );
      return textResult({ id: result });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "record_test_run",
  {
    description:
      "Record one execution of a test case. Updates last_run_at/last_result.",
    inputSchema: {
      project: z.string().optional(),
      testCaseId: z.string(),
      result: z.string(),
      notes: z.string().optional(),
    },
  },
  async ({ project, testCaseId, result, notes }) => {
    try {
      const dv = state.resolveDevlog(project);
      const id = dv.recordTestRun(testCaseId, result, notes ?? null);
      return textResult({ id, result });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "list_use_cases",
  {
    description: "List use cases. Optionally filter by status.",
    inputSchema: {
      project: z.string().optional(),
      status: z.string().optional(),
    },
  },
  async ({ project, status }) => {
    try {
      const dv = state.resolveDevlog(project);
      return textResult(dv.listUseCases(status ?? null));
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "list_test_cases",
  {
    description: "List test cases. Optionally filter by useCaseId and/or status.",
    inputSchema: {
      project: z.string().optional(),
      useCaseId: z.string().optional(),
      status: z.string().optional(),
    },
  },
  async ({ project, useCaseId, status }) => {
    try {
      const dv = state.resolveDevlog(project);
      return textResult(dv.listTestCases(useCaseId ?? null, status ?? null));
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "recent_events",
  {
    description: "Return recent events rows. Default limit 50.",
    inputSchema: {
      project: z.string().optional(),
      limit: z.number().int().optional(),
      kind: z.string().optional(),
    },
  },
  async ({ project, limit, kind }) => {
    try {
      const dv = state.resolveDevlog(project);
      return textResult(dv.recentEvents(limit ?? 50, kind ?? null));
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "scan_health",
  {
    description:
      "Surface project health signals: stale UCs, failing tests, untested TCs, missing TCs, recurring failures.",
    inputSchema: {
      project: z.string().optional(),
    },
  },
  async ({ project }) => {
    try {
      const dv = state.resolveDevlog(project);
      return textResult(dv.scanHealth());
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "get_context_brief",
  {
    description:
      "Single call at session start: active UCs + health warnings + failing tests + recent decisions + inbox digest. Pass `project` to peek at another adopted project's status.",
    inputSchema: {
      project: z.string().optional(),
    },
  },
  async ({ project }) => {
    try {
      const dv = state.resolveInboxDevlog(project);
      return textResult(dv.getContextBrief());
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "next_task",
  {
    description:
      "Return ONE highest-priority work item: failing test, untested TC, missing TC, or all_clear.",
    inputSchema: {
      project: z.string().optional(),
    },
  },
  async ({ project }) => {
    try {
      const dv = state.resolveDevlog(project);
      return textResult(dv.nextTask());
    } catch (e) {
      return errResult(e);
    }
  }
);

// --- Router-only ---------------------------------------------------------

server.registerTool(
  "list_projects",
  {
    description:
      "Router mode only. List all projects under PROJECTS_ROOT/AI/ that have devlog.sqlite (adopted).",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(state.listProjects());
    } catch (e) {
      return errResult(e);
    }
  }
);

// --- Inbox: cross-project messaging --------------------------------------

server.registerTool(
  "send_message",
  {
    description:
      "Send a message to another project's inbox. Recipient session sees it via list_inbox on next session start. Requires PROJECTS_ROOT env. kinds (suggested): feature_request|api_change|help|pattern|reply|note. priority: urgent|high|normal|low (default normal). Use refId to thread related messages.",
    inputSchema: {
      to: z.string(),
      kind: z.string(),
      sender: z.string().optional(),
      priority: z.string().optional(),
      refType: z.string().optional(),
      refId: z.string().optional(),
      content: z.string().optional(),
    },
  },
  async ({ to, kind, sender, priority, refType, refId, content }) => {
    try {
      const recipientDevlog = state.resolveExternalDevlog(to);
      const senderProject = sender ?? state.currentProject;
      if (!senderProject) {
        throw new Error(
          "Could not determine sender project. Pass 'sender' arg or set CODETRAIL_PROJECT env."
        );
      }
      const id = recipientDevlog.sendInboxMessage(
        senderProject,
        to,
        kind,
        priority ?? "normal",
        refType ?? null,
        refId ?? null,
        content ?? null
      );
      return textResult({ id, to, sender: senderProject });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "list_inbox",
  {
    description:
      "List inbox messages for a project (defaults to current project). Filter by status (unread|read|resolved) and/or sender. Ordered by priority (urgent first), newest first within same priority.",
    inputSchema: {
      project: z.string().optional(),
      status: z.string().optional(),
      sender: z.string().optional(),
      limit: z.number().int().optional(),
    },
  },
  async ({ project, status, sender, limit }) => {
    try {
      const dv = state.resolveInboxDevlog(project);
      return textResult(
        dv.listInbox(status ?? null, sender ?? null, limit ?? 50)
      );
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "mark_resolved",
  {
    description:
      "Mark an inbox message as resolved. resolution is a one-line note about how it was handled (e.g., 'shipped in commit abc123'). Optionally pass project to act on another project's inbox.",
    inputSchema: {
      inboxId: z.number().int(),
      resolution: z.string().optional(),
      resolvedBy: z.string().optional(),
      project: z.string().optional(),
    },
  },
  async ({ inboxId, resolution, resolvedBy, project }) => {
    try {
      const dv = state.resolveInboxDevlog(project);
      const by = resolvedBy ?? state.currentProject ?? "unknown";
      const ok = dv.markInboxResolved(inboxId, by, resolution ?? null);
      return textResult({ id: inboxId, resolved: ok, resolvedBy: by });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "get_thread",
  {
    description:
      "Get all inbox messages sharing the same refId (a conversation thread). Optionally filter by refType. Returns rows in ID order (oldest first).",
    inputSchema: {
      refId: z.string(),
      refType: z.string().optional(),
      project: z.string().optional(),
    },
  },
  async ({ refId, refType, project }) => {
    try {
      const dv = state.resolveInboxDevlog(project);
      return textResult(dv.getInboxThread(refType ?? null, refId));
    } catch (e) {
      return errResult(e);
    }
  }
);

// --- Memory / knowledge (workspace mode only) ----------------------------

server.registerTool(
  "save_memory",
  {
    description:
      "Persist a JSON item under a category folder. Workspace mode only.",
    inputSchema: {
      category: z.string(),
      data: z.unknown(),
    },
  },
  async ({ category, data }) => {
    try {
      if (state.routerMode) throw new Error("save_memory not available in router mode");
      const dir = join(state.memoryDir, category);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, "knowledge.json");
      let items: unknown[] = [];
      if (existsSync(file)) {
        try {
          items = JSON.parse(readFileSync(file, "utf8"));
          if (!Array.isArray(items)) items = [];
        } catch {
          items = [];
        }
      }
      items.push({ createdAt: Date.now(), data });
      writeFileSync(file, JSON.stringify(items, null, 2));
      return textResult({ file });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "add_knowledge",
  {
    description:
      "Append text snippet to searchable knowledge store. Workspace mode only.",
    inputSchema: {
      text: z.string(),
    },
  },
  async ({ text }) => {
    try {
      if (state.routerMode) throw new Error("add_knowledge not available in router mode");
      mkdirSync(state.memoryDir, { recursive: true });
      const file = join(state.memoryDir, "search.json");
      let items: string[] = [];
      if (existsSync(file)) {
        try {
          items = JSON.parse(readFileSync(file, "utf8"));
          if (!Array.isArray(items)) items = [];
        } catch {
          items = [];
        }
      }
      items.push(text);
      writeFileSync(file, JSON.stringify(items, null, 2));
      return textResult({ file });
    } catch (e) {
      return errResult(e);
    }
  }
);

server.registerTool(
  "search_knowledge",
  {
    description:
      "Substring-search the knowledge store. Returns up to 5 matches. Workspace mode only.",
    inputSchema: {
      query: z.string(),
    },
  },
  async ({ query }) => {
    try {
      if (state.routerMode) throw new Error("search_knowledge not available in router mode");
      const file = join(state.memoryDir, "search.json");
      if (!existsSync(file)) return textResult([]);
      let items: string[] = [];
      try {
        items = JSON.parse(readFileSync(file, "utf8"));
        if (!Array.isArray(items)) items = [];
      } catch {
        return textResult([]);
      }
      const q = query.toLowerCase();
      const matches = items.filter((x) => x.toLowerCase().includes(q)).slice(0, 5);
      return textResult(matches);
    } catch (e) {
      return errResult(e);
    }
  }
);

// --- Boot -----------------------------------------------------------------

async function main() {
  process.stderr.write(
    `project-agent MCP starting (mode=${state.routerMode ? "router" : "workspace"})\n`
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
