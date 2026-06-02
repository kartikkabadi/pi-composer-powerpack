import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMS_DIR, type RegistryEntry } from "./types.ts";

/** Return the directory path for agent registry files under a project. */
export function projectAgentsDir(project: string): string {
	return join(COMS_DIR, "projects", project, "agents");
}

/** Return the full path to a specific agent's registry JSON file. */
export function registryFilePath(project: string, name: string): string {
	return join(projectAgentsDir(project), `${name}.json`);
}

/** Atomically write a registry entry: write to .tmp then rename. Returns the final path. */
export function writeRegistryAtomic(entry: RegistryEntry, project: string): string {
	const dir = projectAgentsDir(project);
	mkdirSync(dir, { recursive: true });
	const final = registryFilePath(project, entry.name);
	const tmp = `${final}.tmp`;
	writeFileSync(tmp, JSON.stringify(entry, null, 2));
	renameSync(tmp, final);
	return final;
}

/** Read and parse all valid registry entries for a project. Skips malformed files. */
export function readAllRegistryEntries(project: string): RegistryEntry[] {
	const dir = projectAgentsDir(project);
	if (!existsSync(dir)) return [];
	const out: RegistryEntry[] = [];
	let files: string[];
	try {
		files = readdirSync(dir);
	} catch {
		return [];
	}
	for (const f of files) {
		if (!f.endsWith(".json")) continue;
		try {
			const raw = readFileSync(join(dir, f), "utf-8");
			const parsed = JSON.parse(raw) as RegistryEntry;
			if (parsed && typeof parsed.session_id === "string") {
				out.push(parsed);
			}
		} catch {
			// skip malformed
		}
	}
	return out;
}

/** Read all registry entries across every project directory. */
export function readAllRegistryEntriesAcrossProjects(): RegistryEntry[] {
	const root = join(COMS_DIR, "projects");
	let projects: string[];
	try {
		projects = readdirSync(root);
	} catch {
		return [];
	}
	const out: RegistryEntry[] = [];
	for (const p of projects) {
		try {
			if (!statSync(join(root, p)).isDirectory()) continue;
		} catch {
			continue;
		}
		out.push(...readAllRegistryEntries(p));
	}
	return out;
}

/** Best-effort removal of a single agent's registry file. */
export function removeRegistryEntry(project: string, name: string): void {
	try {
		unlinkSync(registryFilePath(project, name));
	} catch {
		// best-effort
	}
}

/** Remove registry entries whose PID is no longer alive (ESRCH). Returns surviving entries. */
export function pruneDeadEntries(project: string): RegistryEntry[] {
	const entries = readAllRegistryEntries(project);
	const live: RegistryEntry[] = [];
	for (const entry of entries) {
		try {
			process.kill(entry.pid, 0);
			live.push(entry);
		} catch (e: any) {
			if (e && e.code === "ESRCH") {
				removeRegistryEntry(project, entry.name);
			} else {
				live.push(entry);
			}
		}
	}
	return live;
}

/** Append a numeric suffix to desiredName if it collides with a live agent in the project. */
export function resolveUniqueName(project: string, desiredName: string): string {
	const liveEntries = pruneDeadEntries(project);
	const liveNames = new Set(liveEntries.map(e => e.name));
	if (!liveNames.has(desiredName)) return desiredName;
	let n = 2;
	while (liveNames.has(`${desiredName}${n}`)) n++;
	return `${desiredName}${n}`;
}

/** Prune dead entries across all projects. Returns the combined list of surviving entries. */
export function pruneDeadEntriesAllProjects(): RegistryEntry[] {
	const root = join(COMS_DIR, "projects");
	let projects: string[];
	try {
		projects = readdirSync(root);
	} catch {
		return [];
	}
	const out: RegistryEntry[] = [];
	for (const p of projects) {
		try {
			if (!statSync(join(root, p)).isDirectory()) continue;
		} catch {
			continue;
		}
		out.push(...pruneDeadEntries(p));
	}
	return out;
}

/** List all project directories under the coms projects root. */
export function listProjects(): string[] {
	const root = join(COMS_DIR, "projects");
	try {
		return readdirSync(root).filter((d) => {
			try { return statSync(join(root, d)).isDirectory(); } catch { return false; }
		});
	} catch {
		return [];
	}
}

/** Resolve a target name or session_id to a live RegistryEntry. Checks local project first, then cross-project. */
export function resolveTarget(
	target: string,
	identity: { project: string } | null,
): RegistryEntry | null {
	if (identity) {
		const localEntries = pruneDeadEntries(identity.project);
		const byName = localEntries.find((e) => e.name === target);
		if (byName) return byName;
	}
	for (const proj of listProjects()) {
		const entries = pruneDeadEntries(proj);
		const bySession = entries.find((e) => e.session_id === target);
		if (bySession) return bySession;
	}
	for (const proj of listProjects()) {
		const entries = pruneDeadEntries(proj);
		const byName = entries.find((e) => e.name === target);
		if (byName) return byName;
	}
	return null;
}
