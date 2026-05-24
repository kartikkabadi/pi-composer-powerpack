import * as fs from "node:fs";
import * as path from "node:path";
import { COMS_DIR, type RegistryEntry } from "./types.ts";

export function projectAgentsDir(project: string): string {
	return path.join(COMS_DIR, "projects", project, "agents");
}

export function registryFilePath(project: string, name: string): string {
	return path.join(projectAgentsDir(project), `${name}.json`);
}

export function writeRegistryAtomic(entry: RegistryEntry, project: string): string {
	const dir = projectAgentsDir(project);
	fs.mkdirSync(dir, { recursive: true });
	const final = registryFilePath(project, entry.name);
	const tmp = `${final}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(entry, null, 2));
	fs.renameSync(tmp, final);
	return final;
}

export function readAllRegistryEntries(project: string): RegistryEntry[] {
	const dir = projectAgentsDir(project);
	if (!fs.existsSync(dir)) return [];
	const out: RegistryEntry[] = [];
	let files: string[];
	try {
		files = fs.readdirSync(dir);
	} catch {
		return [];
	}
	for (const f of files) {
		if (!f.endsWith(".json")) continue;
		try {
			const raw = fs.readFileSync(path.join(dir, f), "utf-8");
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

export function readAllRegistryEntriesAcrossProjects(): RegistryEntry[] {
	const root = path.join(COMS_DIR, "projects");
	let projects: string[];
	try {
		projects = fs.readdirSync(root);
	} catch {
		return [];
	}
	const out: RegistryEntry[] = [];
	for (const p of projects) {
		try {
			if (!fs.statSync(path.join(root, p)).isDirectory()) continue;
		} catch {
			continue;
		}
		out.push(...readAllRegistryEntries(p));
	}
	return out;
}

export function removeRegistryEntry(project: string, name: string): void {
	try {
		fs.unlinkSync(registryFilePath(project, name));
	} catch {
		// best-effort
	}
}

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

export function resolveUniqueName(project: string, desiredName: string): string {
	const liveEntries = pruneDeadEntries(project);
	const liveNames = new Set(liveEntries.map(e => e.name));
	if (!liveNames.has(desiredName)) return desiredName;
	let n = 2;
	while (liveNames.has(`${desiredName}${n}`)) n++;
	return `${desiredName}${n}`;
}

export function pruneDeadEntriesAllProjects(): RegistryEntry[] {
	const root = path.join(COMS_DIR, "projects");
	let projects: string[];
	try {
		projects = fs.readdirSync(root);
	} catch {
		return [];
	}
	const out: RegistryEntry[] = [];
	for (const p of projects) {
		try {
			if (!fs.statSync(path.join(root, p)).isDirectory()) continue;
		} catch {
			continue;
		}
		out.push(...pruneDeadEntries(p));
	}
	return out;
}

export function listProjects(): string[] {
	const root = path.join(COMS_DIR, "projects");
	try {
		return fs.readdirSync(root).filter((d) => {
			try { return fs.statSync(path.join(root, d)).isDirectory(); } catch { return false; }
		});
	} catch {
		return [];
	}
}

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
