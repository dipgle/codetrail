// Spawns the real binary over stdio and checks what `initialize` declares.
//
// Why: a client that follows the MCP spec (opencode 2.2.7) only calls
// `tools/list` when `initialize` declares `capabilities.tools`. rmcp's default
// `ServerHandler::get_info` declares nothing, so opencode saw `tools=0` while
// Claude Code (lenient, calls `tools/list` anyway) saw all of them.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::time::Duration;

struct Server {
    child: Child,
    stdin: ChildStdin,
    lines: Receiver<String>,
}

impl Server {
    fn start() -> Server {
        let root = std::env::temp_dir().join(format!("pa-init-cap-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let mut child = Command::new(env!("CARGO_BIN_EXE_project-agent"))
            .env("PROJECTS_ROOT", &root)
            .current_dir(&root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn project-agent");
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let (tx, lines) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                match line {
                    Ok(l) => {
                        if tx.send(l).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        Server { child, stdin, lines }
    }

    fn send(&mut self, msg: Value) {
        writeln!(self.stdin, "{}", msg).unwrap();
        self.stdin.flush().unwrap();
    }

    /// Next JSON-RPC response carrying `id`. Times out instead of hanging the suite.
    fn response(&self, id: u64) -> Value {
        loop {
            let line = self
                .lines
                .recv_timeout(Duration::from_secs(10))
                .unwrap_or_else(|e| panic!("no response for id={id}: {e}"));
            let v: Value = serde_json::from_str(&line)
                .unwrap_or_else(|e| panic!("stdout line is not JSON ({e}): {line}"));
            if v.get("id") == Some(&json!(id)) {
                return v;
            }
        }
    }

    fn initialize(&mut self) -> Value {
        self.send(json!({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "initialize_capabilities-test", "version": "0"}
            }
        }));
        self.response(1)
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[test]
fn initialize_declares_tools_capability() {
    let mut s = Server::start();
    let init = s.initialize();
    let caps = &init["result"]["capabilities"];
    // Assert the response is a real initialize result first, so a missing
    // `result` cannot read as "capabilities just lacks tools".
    assert!(caps.is_object(), "initialize returned no capabilities: {init}");
    assert!(
        caps.get("tools").is_some(),
        "initialize must declare capabilities.tools (spec clients skip tools/list otherwise): {init}"
    );
}

#[test]
fn tools_list_returns_every_declared_tool() {
    // Count derived from the source, not typed in: every `#[tool(` is one tool.
    let expected = include_str!("../src/main.rs").matches("#[tool(").count();
    assert!(expected > 0, "found no #[tool( in src/main.rs — the counter is blind");

    let mut s = Server::start();
    s.initialize();
    s.send(json!({"jsonrpc": "2.0", "method": "notifications/initialized"}));
    s.send(json!({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}));
    let list = s.response(2);
    let tools = list["result"]["tools"]
        .as_array()
        .unwrap_or_else(|| panic!("tools/list returned no tools array: {list}"));
    assert_eq!(tools.len(), expected, "tools/list: {list}");
}
