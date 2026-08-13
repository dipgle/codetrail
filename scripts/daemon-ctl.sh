#!/usr/bin/env bash
# daemon-ctl.sh — manage per-project runner.sh daemons.
#
# WHY
#   Each project subdir under the projects root has its own file-queue
#   runner daemon (see runner.sh). Claude spawns the daemon on session
#   focus and restarts it after editing the project's .runner-allowlist.
#   No LaunchAgent → avoids macOS TCC blocks under ~/Documents/.
#
# USAGE
#   daemon-ctl.sh ensure  <project>   # start if not running (idempotent)
#   daemon-ctl.sh start   <project>   # start; fails if already running
#   daemon-ctl.sh stop    <project>   # kill if running
#   daemon-ctl.sh restart <project>   # stop + start (use after editing allowlist)
#   daemon-ctl.sh status  <project>   # print pid + state
#   daemon-ctl.sh list                # show all daemons across projects
#
# PROJECT ARG
#   Either a bare name (looked up under <projects-root>/AI/<name>/ then
#   <projects-root>/<name>/) or an absolute path. See PROJECTS_ROOT below.
#
# PIDFILE
#   <project>/scripts/.cmd-results/daemon.pid — written on start, removed on stop.
#   Stale pidfile (process gone) auto-cleaned on next ensure/status.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="$SCRIPT_DIR/runner.sh"
# Projects root, resolved in order of how much it is actually KNOWN:
#
#   1. $CODETRAIL_PROJECTS_ROOT — explicit, always wins.
#   2. Derived from where this script sits. A clone inside the projects tree
#      (<root>/AI/codetrail/scripts/ or <root>/scripts/) already encodes the
#      answer, so read it instead of guessing.
#   3. $HOME guesses — last resort, for a clone parked outside the tree
#      (e.g. ~/.codetrail). ~/projects comes before ~/Documents/projects:
#      macOS TCC guards Documents/ and revokes read access intermittently
#      even with Full Disk Access, which makes a daemon rooted there fail at
#      random. Set CODETRAIL_PROJECTS_ROOT and none of this guessing runs.
derive_projects_root() {
  local d="$SCRIPT_DIR"
  # <root>/AI/codetrail/scripts → up 3
  if [[ "$(basename "$(dirname "$d")")" == "codetrail" \
     && "$(basename "$(dirname "$(dirname "$d")")")" == "AI" ]]; then
    (cd "$d/../../.." && pwd); return 0
  fi
  # <root>/scripts, but only when it looks like a projects tree
  if [[ "$(basename "$d")" == "scripts" && -d "$(dirname "$d")/AI" ]]; then
    (cd "$d/.." && pwd); return 0
  fi
  return 1
}

if [[ -n "${CODETRAIL_PROJECTS_ROOT:-}" ]]; then
  PROJECTS_ROOT="$CODETRAIL_PROJECTS_ROOT"
elif PROJECTS_ROOT="$(derive_projects_root)"; then
  :
elif [[ -d "$HOME/projects" ]]; then
  PROJECTS_ROOT="$HOME/projects"
else
  PROJECTS_ROOT="$HOME/Documents/projects"
fi

resolve_project() {
  local arg="$1"
  if [[ -d "$arg" ]]; then
    (cd "$arg" && pwd)
    return
  fi
  # bare name lookup
  for base in "$PROJECTS_ROOT/AI" "$PROJECTS_ROOT"; do
    if [[ -d "$base/$arg" ]]; then
      (cd "$base/$arg" && pwd)
      return
    fi
  done
  echo "ERROR: cannot resolve project '$arg' (looked under $PROJECTS_ROOT/{AI,})" >&2
  return 1
}

# Kill every runner.sh running FOR THIS project (match on the last argv word =
# the project root, so other projects' daemons are untouched). $2 (optional) is
# a pid to KEEP. Without this, orphans accumulate: a runner left over from an
# old session isn't in the pidfile, so is_running() misses it and start() adds
# a second daemon watching the same queue.
kill_runners_for() {
  local proj="$1" keep="${2:-}"
  local pids pid
  pids="$(ps -Ao pid,command | awk -v proj="$proj" '/runner\.sh/ && $NF==proj {print $1}')"
  for pid in $pids; do
    [[ -n "$keep" && "$pid" == "$keep" ]] && continue
    kill "$pid" 2>/dev/null || true
  done
  # brief grace period for the processes to exit
  [[ -n "$pids" ]] && sleep 1
  return 0
}

pidfile_for() { echo "$1/scripts/.cmd-results/daemon.pid"; }
logfile_for() { echo "$1/scripts/.cmd-results/daemon.log"; }

is_running() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] || return 1
  local pid; pid="$(cat "$pidfile" 2>/dev/null)"
  [[ -n "$pid" ]] || return 1
  # ps -p exits 0 iff pid exists. Also verify it's our runner.sh (defense
  # vs pid recycling — extremely rare on a single-user dev box).
  if ps -p "$pid" -o command= 2>/dev/null | grep -q "runner.sh"; then
    return 0
  fi
  return 1
}

cmd_status() {
  local proj="$1"
  local pidfile; pidfile="$(pidfile_for "$proj")"
  if is_running "$pidfile"; then
    local pid; pid="$(cat "$pidfile")"
    echo "RUNNING  pid=$pid  project=$proj"
    return 0
  fi
  if [[ -f "$pidfile" ]]; then
    echo "STALE    pidfile exists but process gone  project=$proj"
    rm -f "$pidfile"
    return 1
  fi
  echo "STOPPED  project=$proj"
  return 1
}

cmd_start() {
  local proj="$1"
  local pidfile; pidfile="$(pidfile_for "$proj")"
  local logfile; logfile="$(logfile_for "$proj")"
  mkdir -p "$(dirname "$pidfile")"

  if is_running "$pidfile"; then
    local pid; pid="$(cat "$pidfile")"
    echo "ALREADY-RUNNING  pid=$pid  project=$proj" >&2
    return 1
  fi
  # Stale pidfile cleanup + reap orphan runners the pidfile never tracked,
  # so exactly one daemon is left watching this queue after start.
  rm -f "$pidfile"
  kill_runners_for "$proj"

  if [[ ! -f "$proj/.runner-allowlist" ]]; then
    echo "ERROR: missing $proj/.runner-allowlist — create it before starting daemon" >&2
    return 65
  fi

  # Detach on macOS BSD (no setsid): nohup ignores SIGHUP, `&` backgrounds,
  # `</dev/null` + redirected stdout/stderr close inherited fds, `disown`
  # removes from parent's job table so terminal exit doesn't propagate.
  # Subshell so disown applies before our bash exits.
  (
    nohup bash "$RUNNER" "$proj" >>"$logfile" 2>&1 </dev/null &
    daemon_pid=$!
    disown "$daemon_pid" 2>/dev/null || true
    echo "$daemon_pid" > "$pidfile"
  )
  sleep 1
  if is_running "$pidfile"; then
    local pid; pid="$(cat "$pidfile")"
    echo "STARTED  pid=$pid  project=$proj  log=$logfile"
    return 0
  fi
  echo "FAILED   project=$proj — check $logfile" >&2
  tail -10 "$logfile" 2>/dev/null >&2
  return 1
}

cmd_stop() {
  local proj="$1"
  local pidfile; pidfile="$(pidfile_for "$proj")"
  if ! is_running "$pidfile"; then
    echo "NOT-RUNNING  project=$proj"
    rm -f "$pidfile"
    return 0
  fi
  local pid; pid="$(cat "$pidfile")"
  # SIGTERM first, escalate to SIGKILL if still alive after 3s.
  kill "$pid" 2>/dev/null
  for _ in 1 2 3; do
    sleep 1
    ps -p "$pid" -o pid= >/dev/null 2>&1 || break
  done
  if ps -p "$pid" -o pid= >/dev/null 2>&1; then
    kill -9 "$pid" 2>/dev/null
    sleep 1
  fi
  rm -f "$pidfile"
  echo "STOPPED  was-pid=$pid  project=$proj"
}

cmd_ensure() {
  local proj="$1"
  local pidfile; pidfile="$(pidfile_for "$proj")"
  if is_running "$pidfile"; then
    local pid; pid="$(cat "$pidfile")"
    # Reap orphans (keeping the tracked pid) so duplicates can't pile up even
    # when the tracked daemon is healthy.
    kill_runners_for "$proj" "$pid"
    echo "RUNNING  pid=$pid  project=$proj  (no-op; orphans reaped if any)"
    return 0
  fi
  cmd_start "$proj"
}

cmd_restart() {
  local proj="$1"
  cmd_stop "$proj" >/dev/null || true
  cmd_start "$proj"
}

cmd_list() {
  shopt -s nullglob
  local found=0
  for pidfile in "$PROJECTS_ROOT"/{AI,}/*/scripts/.cmd-results/daemon.pid; do
    [[ -f "$pidfile" ]] || continue
    local proj; proj="$(cd "$(dirname "$pidfile")/../.." && pwd)"
    if is_running "$pidfile"; then
      local pid; pid="$(cat "$pidfile")"
      printf "RUNNING  pid=%-6s  %s\n" "$pid" "$proj"
    else
      printf "STALE    (gone)        %s\n" "$proj"
    fi
    found=$((found + 1))
  done
  shopt -u nullglob
  [[ $found -eq 0 ]] && echo "(no daemons known)"
  return 0
}

usage() {
  sed -n '2,25p' "$0"
  exit 64
}

action="${1:-}"
case "$action" in
  ensure|start|stop|restart|status)
    proj_arg="${2:-}"
    [[ -z "$proj_arg" ]] && { echo "ERROR: missing <project> arg" >&2; usage; }
    proj="$(resolve_project "$proj_arg")" || exit 1
    "cmd_$action" "$proj"
    ;;
  list)
    cmd_list
    ;;
  *)
    usage
    ;;
esac
