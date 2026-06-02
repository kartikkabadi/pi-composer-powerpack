import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseMarkdownFrontmatter } from "./frontmatter.ts";
import { piAgentHome } from "../powerpackPaths.ts";

/** Agent definition loaded from markdown frontmatter */
export type AgentDef = {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
	skills: string[];
	filePath: string;
};

/** A single step in an agent chain pipeline */
export type ChainStep = {
	agent: string;
	prompt: string;
};

/** Agent chain definition loaded from YAML */
export type ChainDef = {
	name: string;
	description: string;
	steps: ChainStep[];
};

/** Cache for parsed agent definitions */
const agentCache = new Map<string, AgentDef>();

/** Convert a kebab-case name to Title Case. */
export function displayName(name: string): string {
	if (!name || typeof name !== "string") return "";
	return name
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/** Parse an agent definition from a markdown file. */
export function parseAgentMarkdown(filePath: string): AgentDef | null {
	if (!filePath || typeof filePath !== "string") return null;
	
	// Check cache first
	const cached = agentCache.get(filePath);
	if (cached) return cached;
	
	try {
		const raw = readFileSync(filePath, "utf-8");
		const { fields, skills, body } = parseMarkdownFrontmatter(raw);
		if (!fields.name) return null;

		const def: AgentDef = {
			name: fields.name,
			description: fields.description || "",
			tools: fields.tools || "read,grep,find,ls",
			systemPrompt: body,
			skills,
			filePath,
		};
		
		// Cache the result
		agentCache.set(filePath, def);
		
		return def;
	} catch {
		return null;
	}
}

/** Clear the agent definition cache */
export function clearAgentCache(): void {
	agentCache.clear();
}

/** Get cache statistics */
export function getAgentCacheStats(): { size: number; keys: string[] } {
	return {
		size: agentCache.size,
		keys: Array.from(agentCache.keys()),
	};
}

/**
 * Load Pi-Pi expert agents for a project cwd.
 *
 * Precedence (later wins on name collision): bundled package `agents/pi-pi/`,
 * global `~/.pi/agent/agents/pi-pi/`, then project `.pi/agents/pi-pi/`.
 * Skips `pi-orchestrator.md`.
 */
export function loadPiPiExperts(cwd: string, packageAgentsDir: string): Map<string, AgentDef> {
	const experts = new Map<string, AgentDef>();
	if (!cwd || !packageAgentsDir) return experts;

	const dirs = [
		join(packageAgentsDir, "pi-pi"),
		join(piAgentHome(), "agents", "pi-pi"),
		join(cwd, ".pi", "agents", "pi-pi"),
	];

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		for (const filePath of collectMarkdownFiles(dir, false)) {
			if (filePath.endsWith("pi-orchestrator.md")) continue;
			const def = parseAgentMarkdown(filePath);
			if (def) {
				experts.set(def.name.toLowerCase(), def);
			}
		}
	}

	return experts;
}

function collectMarkdownFiles(dir: string, includePiPiSubdir: boolean): string[] {
	if (!dir || !existsSync(dir)) return [];
	const paths: string[] = [];
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isFile() && entry.name.endsWith(".md")) {
				paths.push(resolve(dir, entry.name));
			}
			if (includePiPiSubdir && entry.isDirectory() && entry.name === "pi-pi") {
				const subDir = join(dir, entry.name);
				for (const sub of readdirSync(subDir)) {
					if (sub.endsWith(".md")) {
						paths.push(resolve(subDir, sub));
					}
				}
			}
		}
	} catch {
		return paths;
	}
	return paths;
}

/**
 * Scan agent definitions from multiple directories.
 *
 * Precedence (first-seen wins): project agents (`.pi/agents`, `.claude/agents`,
 * `agents/`) → global (`~/.pi/agent/agents/`) → package (`agents/` bundled).
 * This means a project-level agent with the same name silently overrides a
 * package-bundled or global definition.
 */
export function scanAgents(options: {
	cwd: string;
	packageAgentsDir: string;
	includePiPiSubdir?: boolean;
}): Map<string, AgentDef> {
	const { cwd, packageAgentsDir, includePiPiSubdir = true } = options;
	const agentHome = piAgentHome();
	const dirs = [
		join(cwd, ".pi", "agents"),
		join(cwd, ".claude", "agents"),
		join(cwd, "agents"),
		join(agentHome, "agents"),
		packageAgentsDir,
	];

	const agents = new Map<string, AgentDef>();

	for (const dir of dirs) {
		for (const filePath of collectMarkdownFiles(dir, includePiPiSubdir)) {
			const def = parseAgentMarkdown(filePath);
			if (def && !agents.has(def.name.toLowerCase())) {
				agents.set(def.name.toLowerCase(), def);
			}
		}
	}

	return agents;
}

export function loadTeamsYaml(raw: string): Record<string, string[]> {
	const parsed = parseYaml(raw) as Record<string, unknown> | null;
	if (!parsed || typeof parsed !== "object") return {};
	const teams: Record<string, string[]> = {};
	for (const [name, value] of Object.entries(parsed)) {
		if (Array.isArray(value)) {
			teams[name] = value.map(String);
		}
	}
	return teams;
}

export function loadChainDefinitions(raw: string): { chains: ChainDef[]; defaultChain?: string } {
	const parsed = parseYaml(raw) as Record<string, unknown> | null;
	if (!parsed || typeof parsed !== "object") {
		return { chains: [] };
	}

	let defaultChain: string | undefined;
	if (typeof parsed.default === "string") {
		defaultChain = parsed.default;
	}

	const chains: ChainDef[] = [];
	for (const [name, value] of Object.entries(parsed)) {
		if (name === "default" || !value || typeof value !== "object") continue;
		const obj = value as Record<string, unknown>;
		const stepsRaw = obj.steps;
		if (!Array.isArray(stepsRaw)) continue;
		const steps: ChainStep[] = stepsRaw
			.map((step) => {
				if (!step || typeof step !== "object") return null;
				const s = step as Record<string, unknown>;
				if (typeof s.agent !== "string") return null;
				return {
					agent: s.agent,
					prompt: typeof s.prompt === "string" ? s.prompt : "",
				};
			})
			.filter((s): s is ChainStep => s !== null);

		chains.push({
			name,
			description: typeof obj.description === "string" ? obj.description : "",
			steps,
		});
	}

	return { chains, defaultChain };
}

export function mergeChains(base: ChainDef[], overlay: ChainDef[]): ChainDef[] {
	const merged = [...base];
	for (const chain of overlay) {
		const idx = merged.findIndex((c) => c.name === chain.name);
		if (idx >= 0) merged[idx] = chain;
		else merged.push(chain);
	}
	return merged;
}

export function mergeTeams(
	base: Record<string, string[]>,
	overlay: Record<string, string[]>,
): Record<string, string[]> {
	return { ...base, ...overlay };
}
