import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { getPiAgentHome } from "./subagentConfig.ts";

export type AgentDef = {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
	skills: string[];
	filePath: string;
};

export type ChainStep = {
	agent: string;
	prompt: string;
};

export type ChainDef = {
	name: string;
	description: string;
	steps: ChainStep[];
};

export function displayName(name: string): string {
	return name
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

export function parseAgentMarkdown(filePath: string): AgentDef | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
		if (!match) return null;

		const frontmatter: Record<string, string> = {};
		const skills: string[] = [];
		for (const line of match[1].split("\n")) {
			const skillItem = line.match(/^\s+-\s+(.+)$/);
			if (skillItem) {
				skills.push(skillItem[1].trim());
				continue;
			}
			const idx = line.indexOf(":");
			if (idx > 0) {
				frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
			}
		}

		if (!frontmatter.name) return null;

		return {
			name: frontmatter.name,
			description: frontmatter.description || "",
			tools: frontmatter.tools || "read,grep,find,ls",
			systemPrompt: match[2].trim(),
			skills,
			filePath,
		};
	} catch {
		return null;
	}
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

export function scanAgents(options: {
	cwd: string;
	packageAgentsDir: string;
	includePiPiSubdir?: boolean;
}): Map<string, AgentDef> {
	const { cwd, packageAgentsDir, includePiPiSubdir = true } = options;
	const piAgentHome = getPiAgentHome();
	const dirs = [
		join(cwd, "agents"),
		join(cwd, ".claude", "agents"),
		join(cwd, ".pi", "agents"),
		packageAgentsDir,
		join(piAgentHome, "agents"),
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
