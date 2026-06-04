// Project dependency graph loader + lookups.
// Reads PROJECTS_GRAPH.yaml from the workspace root. Used by inbox
// broadcast tools to fan out messages to every dependent project.

use anyhow::Result;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Deserialize, Default)]
struct ProjectEntry {
    #[serde(default)]
    depends_on: Vec<String>,
    #[allow(dead_code)]
    description: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct GraphFile {
    #[serde(default)]
    projects: HashMap<String, ProjectEntry>,
}

struct GraphCache {
    depends_on: HashMap<String, Vec<String>>,
    served_by: HashMap<String, Vec<String>>,
    projects: Vec<String>,
    mtime: Option<std::time::SystemTime>,
}

pub struct ProjectGraph {
    graph_path: PathBuf,
    cache: Mutex<GraphCache>,
}

impl ProjectGraph {
    pub fn new(projects_root: &Path) -> Self {
        let graph_path = projects_root.join("PROJECTS_GRAPH.yaml");
        let graph = ProjectGraph {
            graph_path,
            cache: Mutex::new(GraphCache {
                depends_on: HashMap::new(),
                served_by: HashMap::new(),
                projects: Vec::new(),
                mtime: None,
            }),
        };
        let _ = graph.reload();
        graph
    }

    /// Reload from disk. Idempotent. Silent on missing file (clears state).
    fn reload(&self) -> Result<()> {
        let mut cache = self.cache.lock().unwrap();

        if !self.graph_path.exists() {
            cache.depends_on.clear();
            cache.served_by.clear();
            cache.projects.clear();
            cache.mtime = None;
            return Ok(());
        }

        let mtime = std::fs::metadata(&self.graph_path)?.modified().ok();
        if cache.mtime == mtime && cache.mtime.is_some() {
            return Ok(()); // unchanged
        }

        let raw = std::fs::read_to_string(&self.graph_path)?;
        let data: GraphFile = serde_yaml::from_str(&raw).unwrap_or_default();

        cache.depends_on.clear();
        cache.served_by.clear();
        cache.projects = data.projects.keys().cloned().collect();

        for (name, entry) in &data.projects {
            cache.depends_on.insert(name.clone(), entry.depends_on.clone());
            for dep in &entry.depends_on {
                cache
                    .served_by
                    .entry(dep.clone())
                    .or_insert_with(Vec::new)
                    .push(name.clone());
            }
        }

        cache.mtime = mtime;
        Ok(())
    }

    pub fn list_dependencies(&self, project: &str) -> Vec<String> {
        let _ = self.reload();
        let cache = self.cache.lock().unwrap();
        cache.depends_on.get(project).cloned().unwrap_or_default()
    }

    pub fn list_dependents(&self, project: &str) -> Vec<String> {
        let _ = self.reload();
        let cache = self.cache.lock().unwrap();
        cache.served_by.get(project).cloned().unwrap_or_default()
    }

    #[allow(dead_code)]
    pub fn list_projects(&self) -> Vec<String> {
        let _ = self.reload();
        let cache = self.cache.lock().unwrap();
        cache.projects.clone()
    }

    pub fn has_graph(&self) -> bool {
        let _ = self.reload();
        let cache = self.cache.lock().unwrap();
        !cache.projects.is_empty()
    }
}
