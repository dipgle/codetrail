// Project dependency graph loader + lookups.
// Reads PROJECTS_GRAPH.yaml from the workspace root. Used by inbox
// broadcast tools to fan out messages to every dependent project.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

interface ProjectEntry {
  description?: string;
  depends_on?: string[];
}

interface GraphFile {
  projects?: Record<string, ProjectEntry>;
}

export class ProjectGraph {
  private graphPath: string;
  private dependsOn = new Map<string, string[]>();   // project → its upstream deps
  private servedBy = new Map<string, string[]>();    // project → its downstream dependents (inverse)
  private projects: string[] = [];
  private loadedMtime: number | null = null;

  constructor(private projectsRoot: string) {
    this.graphPath = join(projectsRoot, "PROJECTS_GRAPH.yaml");
    this.reload();
  }

  /** Reload from disk. Idempotent. Returns true if anything changed. */
  reload(): boolean {
    if (!existsSync(this.graphPath)) {
      const had = this.projects.length > 0;
      this.dependsOn.clear();
      this.servedBy.clear();
      this.projects = [];
      this.loadedMtime = null;
      return had;
    }

    const mtime = statSync(this.graphPath).mtimeMs;
    if (this.loadedMtime !== null && mtime === this.loadedMtime) return false;

    const raw = readFileSync(this.graphPath, "utf8");
    const data = parse(raw) as GraphFile | null;
    const projects = data?.projects ?? {};

    this.dependsOn.clear();
    this.servedBy.clear();
    this.projects = Object.keys(projects);

    for (const [name, entry] of Object.entries(projects)) {
      const deps = entry.depends_on ?? [];
      this.dependsOn.set(name, deps);
      for (const dep of deps) {
        const arr = this.servedBy.get(dep) ?? [];
        arr.push(name);
        this.servedBy.set(dep, arr);
      }
    }

    this.loadedMtime = mtime;
    return true;
  }

  /** Projects this project DEPENDS ON (its upstream). */
  listDependencies(project: string): string[] {
    this.reload();
    return [...(this.dependsOn.get(project) ?? [])];
  }

  /** Projects that DEPEND ON this project (its downstream — fanout targets). */
  listDependents(project: string): string[] {
    this.reload();
    return [...(this.servedBy.get(project) ?? [])];
  }

  /** All projects declared in the graph. */
  listProjects(): string[] {
    this.reload();
    return [...this.projects];
  }

  hasGraph(): boolean {
    this.reload();
    return this.projects.length > 0;
  }
}
