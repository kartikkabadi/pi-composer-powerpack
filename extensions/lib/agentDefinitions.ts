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

/**
 * Convert a kebab-case name to Title Case.
 *
 * @param name - The kebab-case name to convert
 * @returns Title Case version of the name
 *
 * @example
 * ```ts
 * displayName("cli-expert") // => "Cli Expert"
 * ```
 */
export function displayName(name: string): string {
	return name
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/**
 * Parse an agent definition from a markdown file.
 *
 * Extracts frontmatter fields (name, description, tools) and the
 * markdown body as the system prompt. Returns null if the file
 * cannot be parsed or lacks required fields.
 *
 * @param filePath - Path to the markdown file
 * @returns Parsed agent definition or null if invalid
 */
export function parseAgentMarkdown(filePath: string): AgentDef | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const { fields, skills, body } = parseMarkdownFrontmatter(raw);
		if (!fields.name) return null;

		return {
			name: fields.name,
			description: fields.description || "",
			tools: fields.tools || "read,grep,find,ls",
			systemPrompt: body,
			skills,
			filePath,
		};
	} catch {
		return null;
	}
}

/**
 * Load Pi-Pi expert agents for a project cwd.
 *
 * Precedence (later wins on name collision): bundled package `agents/pi-pi/`,
 * global `~/.pi/agent/agents/pi-pi/`, then project `.pi/agents/pi-pi/`.
 * Skips `pi-orchestrator.md`.
 *
 * @param cwd - The project working directory
 * @param packageAgentsDir - Path to the bundled agents directory
 * @returns Map of expert name to agent definition
 */
export function loadPiPiExperts(cwd: string, packageAgentsDir: string): Map<string, AgentDef> {
	const experts = new Map<string, AgentDef>();
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

/**
 * Collect all markdown files in a directory.
 *
 * @param dir - Directory to search
 * @param includePiPiSubdir - Whether to include pi-pi subdirectory
 * @returns Array of absolute paths to markdown files
 */
function collectMarkdownFiles(dir: string, includePiPiSubdir: boolean): string[] {
	if (!existsSync(dir)) return [];
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
		// best-effort
	}
	return paths;
}

/**
 * Scan for agent definitions across multiple directories.
 *
 * Searches project, global, and package directories for agent
 * definitions. First-seen wins on name collision.
 *
 * @param opts - Options for scanning
 * @param opts.cwd - Project working directory
 * @param opts.packageAgentsDir - Path to bundled agents directory
 * @param opts.includePiPiSubdir - Include pi-pi subdirectory agents
 * @returns Map of agent name to agent definition
 */
export function scanAgents(opts: {
	cwd: string;
	packageAgentsDir: string;
	includePiPiSubdir?: boolean;
}): Map<string, AgentDef> {
	const agents = new Map<string, AgentDef>();
	const dirs = [
		join(opts.cwd, ".pi", "agents"),
		join(piAgentHome(), "agents"),
		opts.packageAgentsDir,
	];

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		for (const filePath of collectMarkdownFiles(dir, opts.includePiPiSubdir ?? false)) {
			const def = parseAgentMarkdown(filePath);
			if (def && !agents.has(def.name.toLowerCase())) {
				agents.set(def.name.toLowerCase(), def);
			}
		}
	}

	return agents;
}

/**
 * Load chain definitions from YAML.
 *
 * @param yaml - Raw YAML string containing chain definitions
 * @returns Array of parsed chain definitions
 */
export function loadChainDefinitions(yaml: string): ChainDef[] {
	const parsed = parseYaml(yaml) as Record<string, unknown>;
	if (!parsed || typeof parsed !== "object") return [];

	const chains: ChainDef[] = [];
	for (const [name, value] of Object.entries(parsed)) {
		if (typeof value !== "object" || value === null) continue;
		const chain = value as Record<string, unknown>;

		const steps: ChainStep[] = [];
		if (Array.isArray(chain.steps)) {
			for (const step of chain.steps) {
				if (typeof step === "object" && step !== null) {
					const s = step as Record<string, unknown>;
					if (typeof s.agent === "string" && typeof s.prompt === "string") {
						steps.push({ agent: s.agent, prompt: s.prompt });
					}
				}
			}
		}

		chains.push({
			name,
			description: typeof chain.description === "string" ? chain.description : "",
			steps,
		});
	}

	return chains;
}

/**
 * Merge chain definitions, with later arrays overriding earlier ones.
 *
 * @param arrays - Arrays of chain definitions to merge
 * @returns Merged array of chain definitions (last-wins on name collision)
 */
export function mergeChains(...arrays: ChainDef[][]): ChainDef[] {
	const map = new Map<string, ChainDef>();
	for (const arr of arrays) {
		for (const chain of arr) {
			map.set(chain.name, chain);
		}
	}
	return Array.from(map.values());
}

/**
 * Load team definitions from YAML.
 *
 * @param yaml - Raw YAML string containing team definitions
 * @returns Record of team name to array of agent names
 */
export function loadTeamsYaml(yaml: string): Record<string, string[]> {
	const parsed = parseYaml(yaml) as Record<string, unknown>;
	if (!parsed || typeof parsed !== "object") return {};

	const teams: Record<string, string[]> = {};
	for (const [name, value] of Object.entries(parsed)) {
		if (Array.isArray(value)) {
			teams[name] = value.filter((v): v is string => typeof v === "string");
		}
	}

	return teams;
}

/**
 * Merge team definitions, with later objects overriding earlier ones.
 *
 * @param arrays - Records of team definitions to merge
 * @returns Merged record of team definitions (last-wins on name collision)
 */
export function mergeTeams(...arrays: Record<string, string[]>[]): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	for (const obj of arrays) {
		for (const [name, agents] of Object.entries(obj)) {
			result[name] = agents;
		}
	}
	return result;
}

export function parseAgentMarkdown(filePath: string): AgentDef | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const { fields, skills, body } = parseMarkdownFrontmatter(raw);
		if (!fields.name) return null;

		return {
			name: fields.name,
			description: fields.description || "",
			tools: fields.tools || "read,grep,find,ls",
			systemPrompt: body,
			skills,
			filePath,
		};
	} catch {
		return null;
	}
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
	if (!existsSync(dir)) return [];
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
