// project-agent MCP server (Rust port).
// API parity with original mcp/server.js. Two modes:
//   - Workspace mode: PROJECT_LOG_DIR or PROJECT_MEMORY_DIR set
//   - Router mode:    PROJECTS_ROOT set → tools require `project` arg

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
use devlog::Devlog;

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
}

impl State {
    fn from_env() -> Result<Self> {
        let projects_root = std::env::var("PROJECTS_ROOT").ok().map(PathBuf::from);
        let router_mode = projects_root.is_some();

        let memory_dir = std::env::var("PROJECT_MEMORY_DIR")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::current_dir().unwrap().join("memory"));

        let default_devlog = if router_mode {
            None
        } else {
            let log_dir = std::env::var("PROJECT_LOG_DIR")
                .ok()
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

        Ok(State {
            router_mode,
            projects_root,
            default_devlog,
            devlog_cache: Mutex::new(HashMap::new()),
            memory_dir,
        })
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

        {
            let cache = self.devlog_cache.lock().unwrap();
            if let Some(dv) = cache.get(&project) {
                return Ok(dv.clone());
            }
        }

        let root = self.projects_root.as_ref().unwrap();
        let candidates = vec![root.join("AI").join(&project), root.join(&project)];
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
            cache.insert(project, dv.clone());
        }
        Ok(dv)
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

    #[tool(description = "Single call at session start: active UCs + health warnings + failing tests + recent decisions.")]
    fn get_context_brief(&self, Parameters(p): Parameters<ProjectOnlyParams>) -> String {
        let dv = match self.state.resolve_devlog(p.project) {
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
