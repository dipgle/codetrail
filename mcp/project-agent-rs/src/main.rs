// project-agent MCP server (Rust port).
// API parity with project-agent-node. Modes:
//   - Workspace mode: PROJECT_LOG_DIR / PROJECT_MEMORY_DIR set
//   - Router mode:    PROJECTS_ROOT set, PROJECT_LOG_DIR not set
//   - Workspace + cross-project: both PROJECTS_ROOT and PROJECT_LOG_DIR set →
//     own devlog as default, inbox tools can reach other projects via PROJECTS_ROOT/AI/

use anyhow::Result;
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters, ServerHandler},
    schemars, tool, tool_handler, tool_router,
    transport::stdio,
    ServiceExt,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

mod devlog;
mod graph;
use devlog::Devlog;
use graph::ProjectGraph;

// --- Param types ----------------------------------------------------------

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct LogEventParams {
    /// Project name. Required in router mode (PROJECTS_ROOT set), omit otherwise.
    project: Option<String>,
    /// message|decision|action|artifact|answer|source|note
    kind: String,
    actor: Option<String>,
    #[serde(rename = "refType")]
    ref_type: Option<String>,
    #[serde(rename = "refId")]
    ref_id: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct UseCaseParams {
    project: Option<String>,
    /// e.g. UC-001
    id: String,
    title: String,
    actor: Option<String>,
    preconditions: Option<String>,
    #[serde(rename = "mainFlow")]
    main_flow: Option<String>,
    #[serde(rename = "altFlow")]
    alt_flow: Option<String>,
    /// draft|active|done|deprecated
    status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct TestCaseParams {
    project: Option<String>,
    /// e.g. TC-001
    id: String,
    #[serde(rename = "useCaseId")]
    use_case_id: String,
    title: String,
    steps: Option<String>,
    expected: Option<String>,
    /// pending|pass|fail|skipped
    status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct TestRunParams {
    project: Option<String>,
    #[serde(rename = "testCaseId")]
    test_case_id: String,
    /// pass|fail|error|skipped
    result: String,
    notes: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ListUcParams {
    project: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ListTcParams {
    project: Option<String>,
    #[serde(rename = "useCaseId")]
    use_case_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct RecentEventsParams {
    project: Option<String>,
    limit: Option<i64>,
    kind: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ProjectOnlyParams {
    project: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct NoParams {}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct SendMessageParams {
    to: String,
    kind: String,
    sender: Option<String>,
    priority: Option<String>,
    #[serde(rename = "refType")]
    ref_type: Option<String>,
    #[serde(rename = "refId")]
    ref_id: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ListInboxParams {
    project: Option<String>,
    status: Option<String>,
    sender: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct MarkResolvedParams {
    #[serde(rename = "inboxId")]
    inbox_id: i64,
    resolution: Option<String>,
    #[serde(rename = "resolvedBy")]
    resolved_by: Option<String>,
    project: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct GetThreadParams {
    #[serde(rename = "refId")]
    ref_id: String,
    #[serde(rename = "refType")]
    ref_type: Option<String>,
    project: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct BroadcastParams {
    kind: String,
    sender: Option<String>,
    priority: Option<String>,
    #[serde(rename = "refType")]
    ref_type: Option<String>,
    #[serde(rename = "refId")]
    ref_id: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct SaveMemoryParams {
    category: String,
    data: serde_json::Value,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct AddKnowledgeParams {
    text: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct SearchKnowledgeParams {
    query: String,
}

// --- State ---------------------------------------------------------------

struct State {
    router_mode: bool,
    projects_root: Option<PathBuf>,
    default_devlog: Option<Arc<Devlog>>,
    devlog_cache: Mutex<HashMap<String, Arc<Devlog>>>,
    memory_dir: PathBuf,
    current_project: Option<String>,
    graph: Option<ProjectGraph>,
}

impl State {
    fn from_env() -> Result<Self> {
        let projects_root = std::env::var("PROJECTS_ROOT").ok().map(PathBuf::from);
        let log_env = std::env::var("PROJECT_LOG_DIR").ok();
        // Router mode = PROJECTS_ROOT set AND no project-scoped log dir.
        // Both set => workspace + cross-project (default devlog + projectsRoot access).
        let router_mode = projects_root.is_some() && log_env.is_none();

        let memory_dir = std::env::var("PROJECT_MEMORY_DIR")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::current_dir().unwrap().join("memory"));

        let default_devlog = if router_mode {
            None
        } else {
            let log_dir = log_env
                .as_ref()
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    if memory_dir.parent().is_some() {
                        memory_dir.parent().unwrap().join("logs")
                    } else {
                        std::env::current_dir().unwrap().join("logs")
                    }
                });
            let db = log_dir.join("devlog.sqlite");
            Some(Arc::new(Devlog::open(&db)?))
        };

        let current_project = std::env::var("CODETRAIL_PROJECT")
            .ok()
            .or_else(|| Self::derive_project_name(&memory_dir));

        let graph = projects_root.as_ref().map(|root| ProjectGraph::new(root));

        Ok(State {
            router_mode,
            projects_root,
            default_devlog,
            devlog_cache: Mutex::new(HashMap::new()),
            memory_dir,
            current_project,
            graph,
        })
    }

    fn derive_project_name(memory_dir: &PathBuf) -> Option<String> {
        // Convention: <root>/AI/<project>/memory or <root>/<project>/memory.
        let parts: Vec<&str> = memory_dir
            .components()
            .filter_map(|c| c.as_os_str().to_str())
            .collect();
        for (i, p) in parts.iter().enumerate() {
            if *p == "AI" && i + 1 < parts.len() {
                return Some(parts[i + 1].to_string());
            }
        }
        if parts.len() >= 2 && parts.last() == Some(&"memory") {
            return Some(parts[parts.len() - 2].to_string());
        }
        None
    }

    fn resolve_devlog(&self, project: Option<String>) -> Result<Arc<Devlog>> {
        if !self.router_mode {
            return self
                .default_devlog
                .clone()
                .ok_or_else(|| anyhow::anyhow!("default devlog not initialized"));
        }
        let project = project
            .ok_or_else(|| anyhow::anyhow!("router mode requires 'project' argument"))?;
        self.resolve_external_devlog(&project)
    }

    fn resolve_external_devlog(&self, project: &str) -> Result<Arc<Devlog>> {
        if self.projects_root.is_none() {
            return Err(anyhow::anyhow!(
                "Cross-project messaging requires PROJECTS_ROOT env to be set"
            ));
        }
        {
            let cache = self.devlog_cache.lock().unwrap();
            if let Some(dv) = cache.get(project) {
                return Ok(dv.clone());
            }
        }
        let root = self.projects_root.as_ref().unwrap();
        let candidates = vec![root.join("AI").join(project), root.join(project)];
        let project_dir = candidates
            .iter()
            .find(|d| d.exists())
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Project '{}' not found under {}/AI/ or {}/",
                    project,
                    root.display(),
                    root.display()
                )
            })?
            .clone();
        let db = project_dir.join("logs").join("devlog.sqlite");
        if !db.exists() {
            return Err(anyhow::anyhow!(
                "Project '{}' has no devlog at {}. Run 'adopt' first.",
                project,
                db.display()
            ));
        }
        let dv = Arc::new(Devlog::open(&db)?);
        {
            let mut cache = self.devlog_cache.lock().unwrap();
            cache.insert(project.to_string(), dv.clone());
        }
        Ok(dv)
    }

    /// For inbox tools: explicit project param > current project's own devlog.
    fn resolve_inbox_devlog(&self, project: Option<&str>) -> Result<Arc<Devlog>> {
        if let Some(p) = project {
            if Some(p) != self.current_project.as_deref() {
                return self.resolve_external_devlog(p);
            }
        }
        if let Some(dv) = &self.default_devlog {
            return Ok(dv.clone());
        }
        if let Some(p) = project {
            return self.resolve_external_devlog(p);
        }
        Err(anyhow::anyhow!(
            "No project specified and no default devlog"
        ))
    }

    fn list_projects(&self) -> Result<Vec<serde_json::Value>> {
        if !self.router_mode {
            return Err(anyhow::anyhow!(
                "list_projects only available in router mode (set PROJECTS_ROOT)"
            ));
        }
        let ai_dir = self.projects_root.as_ref().unwrap().join("AI");
        let mut result = Vec::new();
        if ai_dir.exists() {
            for entry in fs::read_dir(&ai_dir)? {
                let entry = entry?;
                if !entry.file_type()?.is_dir() {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                let project_dir = entry.path();
                let db = project_dir.join("logs").join("devlog.sqlite");
                if db.exists() {
                    result.push(serde_json::json!({
                        "name": name,
                        "path": project_dir.display().to_string(),
                        "adopted": true,
                    }));
                }
            }
        }
        Ok(result)
    }
}

// --- Helpers --------------------------------------------------------------

fn j(v: impl Serialize) -> String {
    serde_json::to_string(&v).unwrap_or_else(|e| format!("{{\"error\":\"{}\"}}", e))
}

fn jerr(msg: impl std::fmt::Display) -> String {
    format!(
        r#"{{"error":"{}"}}"#,
        msg.to_string().replace('\\', "\\\\").replace('"', "\\\"")
    )
}

// --- Server ---------------------------------------------------------------

#[derive(Clone)]
struct ProjectAgent {
    tool_router: ToolRouter<Self>,
    state: Arc<State>,
}

impl ProjectAgent {
    fn new(state: Arc<State>) -> Self {
        Self {
            tool_router: Self::tool_router(),
            state,
        }
    }
}

#[tool_router]
impl ProjectAgent {
    // --- Devlog tools (both modes) ---

    #[tool(
        description = "Append a row to devlog.sqlite. \
        kinds: message|decision|action|artifact|answer|source|note. \
        In router mode pass `project` (folder name under PROJECTS_ROOT/AI/)."
    )]
    fn log_event(&self, Parameters(p): Parameters<LogEventParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.log_event(
            &p.kind,
            p.actor.as_deref(),
            p.ref_type.as_deref(),
            p.ref_id.as_deref(),
            p.content.as_deref(),
        ) {
            Ok(id) => format!(r#"{{"id":{}}}"#, id),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Create or update a use case (UC-xxx). Upserts by id.")]
    fn create_use_case(&self, Parameters(p): Parameters<UseCaseParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        let status = p.status.as_deref().unwrap_or("draft");
        match dv.upsert_use_case(
            &p.id,
            &p.title,
            p.actor.as_deref(),
            p.preconditions.as_deref(),
            p.main_flow.as_deref(),
            p.alt_flow.as_deref(),
            status,
        ) {
            Ok(id) => format!(r#"{{"id":"{}"}}"#, id),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Create or update a test case (TC-xxx) linked to a use case.")]
    fn create_test_case(&self, Parameters(p): Parameters<TestCaseParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        let status = p.status.as_deref().unwrap_or("pending");
        match dv.upsert_test_case(
            &p.id,
            &p.use_case_id,
            &p.title,
            p.steps.as_deref(),
            p.expected.as_deref(),
            status,
        ) {
            Ok(id) => format!(r#"{{"id":"{}"}}"#, id),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Record one execution of a test case. Updates last_run_at/last_result.")]
    fn record_test_run(&self, Parameters(p): Parameters<TestRunParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.record_test_run(&p.test_case_id, &p.result, p.notes.as_deref()) {
            Ok(id) => format!(r#"{{"id":{},"result":"{}"}}"#, id, p.result),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "List use cases. Optionally filter by status.")]
    fn list_use_cases(&self, Parameters(p): Parameters<ListUcParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.list_use_cases(p.status.as_deref()) {
            Ok(rows) => j(rows),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "List test cases. Optionally filter by useCaseId and/or status.")]
    fn list_test_cases(&self, Parameters(p): Parameters<ListTcParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.list_test_cases(p.use_case_id.as_deref(), p.status.as_deref()) {
            Ok(rows) => j(rows),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Return recent events rows. Default limit 50.")]
    fn recent_events(&self, Parameters(p): Parameters<RecentEventsParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.recent_events(p.limit.unwrap_or(50), p.kind.as_deref()) {
            Ok(rows) => j(rows),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Surface project health signals: stale UCs, failing tests, untested TCs, missing TCs, recurring failures.")]
    fn scan_health(&self, Parameters(p): Parameters<ProjectOnlyParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.scan_health() {
            Ok(h) => j(h),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Single call at session start: active UCs + health warnings + failing tests + recent decisions + inbox digest. Pass `project` to peek at another adopted project's status.")]
    fn get_context_brief(&self, Parameters(p): Parameters<ProjectOnlyParams>) -> String {
        let dv = match self.state.resolve_inbox_devlog(p.project.as_deref()) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.get_context_brief() {
            Ok(b) => j(b),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Return ONE highest-priority work item: failing test, untested TC, missing TC, or all_clear.")]
    fn next_task(&self, Parameters(p): Parameters<ProjectOnlyParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.next_task() {
            Ok(t) => j(t),
            Err(e) => jerr(e),
        }
    }

    // --- Router-only ---

    #[tool(description = "Router mode only. List all projects under PROJECTS_ROOT/AI/ that have devlog.sqlite (adopted).")]
    fn list_projects(&self, _: Parameters<NoParams>) -> String {
        match self.state.list_projects() {
            Ok(rows) => j(rows),
            Err(e) => jerr(e),
        }
    }

    // --- Inbox: cross-project messaging ---

    #[tool(
        description = "Send a message to another project's inbox. Requires PROJECTS_ROOT env. \
        kinds (suggested): feature_request|api_change|help|pattern|reply|note. \
        priority: urgent|high|normal|low (default normal). Use refId to thread related messages."
    )]
    fn send_message(&self, Parameters(p): Parameters<SendMessageParams>) -> String {
        let dv = match self.state.resolve_external_devlog(&p.to) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        let sender_project = match p.sender.or_else(|| self.state.current_project.clone()) {
            Some(s) => s,
            None => {
                return jerr(
                    "Could not determine sender project. Pass 'sender' arg or set CODETRAIL_PROJECT env.",
                )
            }
        };
        let priority = p.priority.as_deref().unwrap_or("normal");
        match dv.send_inbox_message(
            &sender_project,
            &p.to,
            &p.kind,
            priority,
            p.ref_type.as_deref(),
            p.ref_id.as_deref(),
            p.content.as_deref(),
        ) {
            Ok(id) => format!(
                r#"{{"id":{},"to":"{}","sender":"{}"}}"#,
                id, p.to, sender_project
            ),
            Err(e) => jerr(e),
        }
    }

    #[tool(
        description = "List inbox messages for a project (defaults to current). \
        Filter by status (unread|read|resolved) and/or sender. Ordered by priority (urgent first), newest first within same priority."
    )]
    fn list_inbox(&self, Parameters(p): Parameters<ListInboxParams>) -> String {
        let dv = match self.state.resolve_inbox_devlog(p.project.as_deref()) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.list_inbox(p.status.as_deref(), p.sender.as_deref(), p.limit.unwrap_or(50)) {
            Ok(rows) => j(rows),
            Err(e) => jerr(e),
        }
    }

    #[tool(
        description = "Mark an inbox message as resolved. resolution is a one-line note about how it was handled."
    )]
    fn mark_resolved(&self, Parameters(p): Parameters<MarkResolvedParams>) -> String {
        let dv = match self.state.resolve_inbox_devlog(p.project.as_deref()) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        let by = p
            .resolved_by
            .or_else(|| self.state.current_project.clone())
            .unwrap_or_else(|| "unknown".to_string());
        match dv.mark_inbox_resolved(p.inbox_id, &by, p.resolution.as_deref()) {
            Ok(ok) => format!(
                r#"{{"id":{},"resolved":{},"resolvedBy":"{}"}}"#,
                p.inbox_id, ok, by
            ),
            Err(e) => jerr(e),
        }
    }

    #[tool(
        description = "Get all inbox messages sharing the same refId (a conversation thread). \
        Optionally filter by refType. Rows returned oldest first."
    )]
    fn get_thread(&self, Parameters(p): Parameters<GetThreadParams>) -> String {
        let dv = match self.state.resolve_inbox_devlog(p.project.as_deref()) {
            Ok(dv) => dv,
            Err(e) => return jerr(e),
        };
        match dv.get_inbox_thread(p.ref_type.as_deref(), &p.ref_id) {
            Ok(rows) => j(rows),
            Err(e) => jerr(e),
        }
    }

    // --- L4 broadcast: fan out via PROJECTS_GRAPH.yaml ---

    #[tool(
        description = "List projects that depend on the given project (its downstream — broadcast targets). Reads PROJECTS_GRAPH.yaml at workspace root."
    )]
    fn list_dependents(&self, Parameters(p): Parameters<ProjectOnlyParams>) -> String {
        let graph = match &self.state.graph {
            Some(g) => g,
            None => return jerr("PROJECTS_ROOT not set — no graph available"),
        };
        let target = p.project.or_else(|| self.state.current_project.clone());
        let target = match target {
            Some(t) => t,
            None => {
                return jerr(
                    "No project specified and no current project derivable. Pass 'project' or set CODETRAIL_PROJECT.",
                )
            }
        };
        let deps = graph.list_dependents(&target);
        j(serde_json::json!({ "project": target, "dependents": deps }))
    }

    #[tool(
        description = "List projects the given project depends on (its upstream). Reads PROJECTS_GRAPH.yaml at workspace root."
    )]
    fn list_dependencies(&self, Parameters(p): Parameters<ProjectOnlyParams>) -> String {
        let graph = match &self.state.graph {
            Some(g) => g,
            None => return jerr("PROJECTS_ROOT not set — no graph available"),
        };
        let target = p.project.or_else(|| self.state.current_project.clone());
        let target = match target {
            Some(t) => t,
            None => return jerr("No project specified and no current project derivable"),
        };
        let deps = graph.list_dependencies(&target);
        j(serde_json::json!({ "project": target, "dependencies": deps }))
    }

    #[tool(
        description = "Send the same message to every dependent project's inbox. Sender = current project (or override via `sender`). Returns the list of inbox IDs created per recipient. Use this for API changes, deprecations, breaking-change announcements."
    )]
    fn broadcast_to_dependents(&self, Parameters(p): Parameters<BroadcastParams>) -> String {
        let graph = match &self.state.graph {
            Some(g) => g,
            None => return jerr("PROJECTS_ROOT not set — no graph available"),
        };
        let sender_project = match p.sender.or_else(|| self.state.current_project.clone()) {
            Some(s) => s,
            None => {
                return jerr(
                    "Could not determine sender project. Pass 'sender' or set CODETRAIL_PROJECT.",
                )
            }
        };
        let dependents = graph.list_dependents(&sender_project);
        let priority = p.priority.as_deref().unwrap_or("normal");
        let mut results = Vec::new();
        for recipient in &dependents {
            let dv = match self.state.resolve_external_devlog(recipient) {
                Ok(dv) => dv,
                Err(e) => {
                    results.push(serde_json::json!({
                        "recipient": recipient,
                        "error": e.to_string()
                    }));
                    continue;
                }
            };
            match dv.send_inbox_message(
                &sender_project,
                recipient,
                &p.kind,
                priority,
                p.ref_type.as_deref(),
                p.ref_id.as_deref(),
                p.content.as_deref(),
            ) {
                Ok(id) => results.push(serde_json::json!({
                    "recipient": recipient,
                    "inbox_id": id
                })),
                Err(e) => results.push(serde_json::json!({
                    "recipient": recipient,
                    "error": e.to_string()
                })),
            }
        }
        j(serde_json::json!({
            "sender": sender_project,
            "fanout": results
        }))
    }

    // --- Memory / knowledge (workspace mode only — file-based) ---

    #[tool(description = "Persist a JSON item under a category folder. Workspace mode only.")]
    fn save_memory(&self, Parameters(p): Parameters<SaveMemoryParams>) -> String {
        if self.state.router_mode {
            return jerr("save_memory not available in router mode");
        }
        let dir = self.state.memory_dir.join(&p.category);
        if let Err(e) = fs::create_dir_all(&dir) {
            return jerr(e);
        }
        let file = dir.join("knowledge.json");
        let mut items: Vec<serde_json::Value> = if file.exists() {
            match fs::read_to_string(&file).and_then(|s| {
                serde_json::from_str(&s).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
            }) {
                Ok(v) => v,
                Err(_) => vec![],
            }
        } else {
            vec![]
        };
        items.push(serde_json::json!({
            "createdAt": chrono::Utc::now().timestamp_millis(),
            "data": p.data,
        }));
        let s = match serde_json::to_string_pretty(&items) {
            Ok(s) => s,
            Err(e) => return jerr(e),
        };
        match fs::write(&file, s) {
            Ok(_) => format!(r#"{{"file":"{}"}}"#, file.display()),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Append text snippet to searchable knowledge store. Workspace mode only.")]
    fn add_knowledge(&self, Parameters(p): Parameters<AddKnowledgeParams>) -> String {
        if self.state.router_mode {
            return jerr("add_knowledge not available in router mode");
        }
        if let Err(e) = fs::create_dir_all(&self.state.memory_dir) {
            return jerr(e);
        }
        let file = self.state.memory_dir.join("search.json");
        let mut items: Vec<String> = if file.exists() {
            fs::read_to_string(&file)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            vec![]
        };
        items.push(p.text);
        match serde_json::to_string_pretty(&items)
            .map_err(anyhow::Error::from)
            .and_then(|s| fs::write(&file, s).map_err(anyhow::Error::from))
        {
            Ok(_) => format!(r#"{{"file":"{}"}}"#, file.display()),
            Err(e) => jerr(e),
        }
    }

    #[tool(description = "Substring-search the knowledge store. Returns up to 5 matches. Workspace mode only.")]
    fn search_knowledge(&self, Parameters(p): Parameters<SearchKnowledgeParams>) -> String {
        if self.state.router_mode {
            return jerr("search_knowledge not available in router mode");
        }
        let file = self.state.memory_dir.join("search.json");
        let empty: Vec<String> = vec![];
        if !file.exists() {
            return j(empty);
        }
        let items: Vec<String> = match fs::read_to_string(&file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
        {
            Some(v) => v,
            None => return j(empty),
        };
        let q = p.query.to_lowercase();
        let matches: Vec<String> = items
            .into_iter()
            .filter(|x| x.to_lowercase().contains(&q))
            .take(5)
            .collect();
        j(matches)
    }
}

#[tool_handler]
impl ServerHandler for ProjectAgent {}

#[tokio::main]
async fn main() -> Result<()> {
    let state = Arc::new(State::from_env()?);
    eprintln!(
        "project-agent MCP starting (mode={})",
        if state.router_mode { "router" } else { "workspace" }
    );
    let agent = ProjectAgent::new(state);
    let service = agent.serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}
