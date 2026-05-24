/**
 * Agent Chain — Sequential pipeline orchestrator
 *
 * Runs opinionated, repeatable agent workflows. Chains are defined in
 * .pi/agents/agent-chain.yaml — each chain is a sequence of agent steps
 * with prompt templates. The user's original prompt flows into step 1,
 * the output becomes $INPUT for step 2's prompt template, and so on.
 * $ORIGINAL is always the user's original prompt.
 *
 * The primary Pi agent is a pipeline dispatcher — by default it can ONLY call
 * `run_chain` (mode B). Use /direct for one-off work with full tools.
 *
 * Default chain: PI_DEFAULT_CHAIN env, `default:` in agent-chain.yaml, else
 * full-review.
 *
 * Commands:
 *   /chain             — switch active chain
 *   /chain-list        — list all available chains
 *   /chain-mode        — dispatcher mode (run_chain only)
 *   /direct            — full tools for quick one-off work
 *   /chain-run <task>  — hint to run the active chain on a task
 *
 * Usage: /chain-mode after installing the package with pi install.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyExtensionDefaults } from "./themeMap.ts";
import { powerpackAgentsDir, powerpackCursorSdkExtension, resolvePiBinary } from "./powerpackPaths.ts";

const PI_AGENT_HOME = process.env.PI_CODING_AGENT_DIR || join(process.env.HOME || "", ".pi", "agent");
const CURSOR_MODEL = process.env.PI_SUBAGENT_MODEL || "cursor/composer-2.5";
const CURSOR_SDK_EXTENSION = process.env.PI_CURSOR_SDK_EXTENSION || powerpackCursorSdkExtension(import.meta.url);
const CURSOR_FAST_FLAGS = process.env.PI_SUBAGENT_CURSOR_FAST === "0" ? [] : ["--cursor-fast"];
const PACKAGE_AGENTS_DIR = powerpackAgentsDir(import.meta.url);

// ── Types ────────────────────────────────────────

interface ChainStep {
	agent: string;
	prompt: string;
}

interface ChainDef {
	name: string;
	description: string;
	steps: ChainStep[];
}

interface AgentDef {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
}

interface StepState {
	agent: string;
	status: "pending" | "running" | "done" | "error";
	elapsed: number;
	lastWork: string;
}

// ── Display Name Helper ──────────────────────────

function displayName(name: string): string {
	return name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Chain YAML Parser ────────────────────────────

function parseChainYaml(raw: string): ChainDef[] {
	const chains: ChainDef[] = [];
	let current: ChainDef | null = null;
	let currentStep: ChainStep | null = null;

	for (const line of raw.split("\n")) {
		// Chain name: top-level key
		const chainMatch = line.match(/^(\S[^:]*):$/);
		if (chainMatch) {
			if (current && currentStep) {
				current.steps.push(currentStep);
				currentStep = null;
			}
			current = { name: chainMatch[1].trim(), description: "", steps: [] };
			chains.push(current);
			continue;
		}

		// Chain description
		const descMatch = line.match(/^\s+description:\s+(.+)$/);
		if (descMatch && current && !currentStep) {
			let desc = descMatch[1].trim();
			if ((desc.startsWith('"') && desc.endsWith('"')) ||
				(desc.startsWith("'") && desc.endsWith("'"))) {
				desc = desc.slice(1, -1);
			}
			current.description = desc;
			continue;
		}

		// "steps:" label — skip
		if (line.match(/^\s+steps:\s*$/) && current) {
			continue;
		}

		// Step agent line
		const agentMatch = line.match(/^\s+-\s+agent:\s+(.+)$/);
		if (agentMatch && current) {
			if (currentStep) {
				current.steps.push(currentStep);
			}
			currentStep = { agent: agentMatch[1].trim(), prompt: "" };
			continue;
		}

		// Step prompt line
		const promptMatch = line.match(/^\s+prompt:\s+(.+)$/);
		if (promptMatch && currentStep) {
			let prompt = promptMatch[1].trim();
			if ((prompt.startsWith('"') && prompt.endsWith('"')) ||
				(prompt.startsWith("'") && prompt.endsWith("'"))) {
				prompt = prompt.slice(1, -1);
			}
			prompt = prompt.replace(/\\n/g, "\n");
			currentStep.prompt = prompt;
			continue;
		}
	}

	if (current && currentStep) {
		current.steps.push(currentStep);
	}

	return chains.filter((c) => c.name !== "default" || c.steps.length > 0);
}

function parseChainFile(raw: string): { chains: ChainDef[]; defaultChain?: string } {
	const defaultMatch = raw.match(/^default:\s*"?([^"\n#]+)"?\s*$/m);
	const defaultChain = defaultMatch?.[1]?.trim();
	return { chains: parseChainYaml(raw), defaultChain };
}

function mergeChains(base: ChainDef[], overlay: ChainDef[]): ChainDef[] {
	const merged = [...base];
	for (const chain of overlay) {
		const idx = merged.findIndex((c) => c.name === chain.name);
		if (idx >= 0) merged[idx] = chain;
		else merged.push(chain);
	}
	return merged;
}

// ── Frontmatter Parser ───────────────────────────

function parseAgentFile(filePath: string): AgentDef | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
		if (!match) return null;

		const frontmatter: Record<string, string> = {};
		for (const line of match[1].split("\n")) {
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
		};
	} catch {
		return null;
	}
}

function scanAgentDirs(cwd: string): Map<string, AgentDef> {
	const dirs = [
		join(cwd, "agents"),
		join(cwd, ".claude", "agents"),
		join(cwd, ".pi", "agents"),
		PACKAGE_AGENTS_DIR,
		join(PI_AGENT_HOME, "agents"),
	];

	const agents = new Map<string, AgentDef>();

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		try {
			for (const file of readdirSync(dir)) {
				if (!file.endsWith(".md")) continue;
				const fullPath = resolve(dir, file);
				const def = parseAgentFile(fullPath);
				if (def && !agents.has(def.name.toLowerCase())) {
					agents.set(def.name.toLowerCase(), def);
				}
			}
		} catch {}
	}

	return agents;
}

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let allAgents: Map<string, AgentDef> = new Map();
	let chains: ChainDef[] = [];
	let activeChain: ChainDef | null = null;
	let widgetCtx: any;
	let sessionDir = "";
	const agentSessions: Map<string, string | null> = new Map();

	// Per-step state for the active chain
	let stepStates: StepState[] = [];
	let pendingReset = false;
		let defaultChainHint: string | undefined;
		let chainMode = false;
		let allToolNames: string[] = [];
		let lastUserPrompt = "";
		let chainRanThisTurn = false;

	function loadChains(cwd: string) {
		sessionDir = join(cwd, ".pi", "agent-sessions");
		if (!existsSync(sessionDir)) {
			mkdirSync(sessionDir, { recursive: true });
		}

		allAgents = scanAgentDirs(cwd);

		agentSessions.clear();
		for (const [key] of allAgents) {
			const sessionFile = join(sessionDir, `chain-${key}.json`);
			agentSessions.set(key, existsSync(sessionFile) ? sessionFile : null);
		}

			const packageChainPath = join(PACKAGE_AGENTS_DIR, "agent-chain.yaml");
			const globalChainPath = join(PI_AGENT_HOME, "agents", "agent-chain.yaml");
			const projectChainPath = join(cwd, ".pi", "agents", "agent-chain.yaml");
			let merged: ChainDef[] = [];
			defaultChainHint = undefined;

			if (existsSync(packageChainPath)) {
				try {
					const parsed = parseChainFile(readFileSync(packageChainPath, "utf-8"));
					merged = parsed.chains;
					defaultChainHint = parsed.defaultChain;
				} catch {
					merged = [];
				}
			}

			if (existsSync(globalChainPath)) {
				try {
					const parsed = parseChainFile(readFileSync(globalChainPath, "utf-8"));
					merged = mergeChains(merged, parsed.chains);
					defaultChainHint = parsed.defaultChain;
				} catch {
					// keep package chains
				}
			}

		if (existsSync(projectChainPath)) {
			try {
				const parsed = parseChainFile(readFileSync(projectChainPath, "utf-8"));
				merged = mergeChains(merged, parsed.chains);
				if (parsed.defaultChain) defaultChainHint = parsed.defaultChain;
			} catch {
				// keep global chains
			}
		}

		chains = merged;
	}

	function resolveDefaultChain(ctx?: any): ChainDef | null {
		if (chains.length === 0) return null;

		const preferred =
			process.env.PI_DEFAULT_CHAIN?.trim() ||
			defaultChainHint ||
			"full-review";

		const found = chains.find((c) => c.name === preferred);
		if (found) return found;

		ctx?.ui?.notify(
			`Chain "${preferred}" not found — using ${chains[0].name}`,
			"warning",
		);
		return chains[0];
		}

		function applyChainMode(ctx?: any) {
			chainMode = true;
			pi.setActiveTools(["run_chain"]);
			ctx?.ui?.setStatus("agent-chain", `Chain mode · ${activeChain?.name ?? "?"}`);
			updateWidget();
			installFooter(ctx);
		}

		function applyDirectMode(ctx?: any) {
			chainMode = false;
			if (allToolNames.length > 0) {
				pi.setActiveTools(allToolNames);
			}
			ctx?.ui?.setStatus("agent-chain", undefined);
			ctx?.ui?.setWidget("agent-chain", undefined);
			ctx?.ui?.setFooter(undefined);
		}

	function buildDispatcherSystemPrompt(): string {
		if (!activeChain) return "";

		const flow = activeChain.steps.map((s) => displayName(s.agent)).join(" → ");
		const desc = activeChain.description ? `\n${activeChain.description}` : "";
		const steps = activeChain.steps
			.map((s, i) => {
				const agentDef = allAgents.get(s.agent.toLowerCase());
				const agentDesc = agentDef?.description || "";
				return `${i + 1}. **${displayName(s.agent)}** — ${agentDesc}`;
			})
			.join("\n");

		const seen = new Set<string>();
		const agentCatalog = activeChain.steps
			.filter((s) => {
				const key = s.agent.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((s) => {
				const agentDef = allAgents.get(s.agent.toLowerCase());
				if (!agentDef) return `### ${displayName(s.agent)}\nAgent not found.`;
				return `### ${displayName(agentDef.name)}\n${agentDef.description}\n**Tools:** ${agentDef.tools}`;
			})
			.join("\n\n");

		return `You are a pipeline dispatcher. You do NOT have direct access to the codebase.
You MUST delegate all substantive work through the run_chain tool.

## Active Chain: ${activeChain.name}${desc}
Flow: ${flow}

${steps}

## Agent Details

${agentCatalog}

## Rules
- On every user message: call run_chain with the user's full request as the task (unless they used /direct).
- Do NOT read, write, grep, or bash yourself — the chain agents do that.
- After run_chain returns: give a concise summary, key findings, blockers, and a suggested next step.
- Do NOT re-run scout/plan/build/review in your own words; trust the chain output.
- You may call run_chain again if the user asks for a follow-up pipeline run.

## How run_chain Works
- Each step's output feeds into the next as $INPUT; $ORIGINAL is the initial task.
- Chain agents keep session memory across runs in this project.
- Slash commands (/chain, /direct, /chain-mode) are handled by the extension — not via run_chain.`;
	}

	function activateChain(chain: ChainDef) {
		activeChain = chain;
		stepStates = chain.steps.map(s => ({
			agent: s.agent,
			status: "pending" as const,
			elapsed: 0,
			lastWork: "",
		}));
		// Skip widget re-registration if reset is pending — let before_agent_start handle it
		if (!pendingReset) {
			updateWidget();
		}
	}

	// ── Card Rendering ──────────────────────────

	function renderCard(state: StepState, colWidth: number, theme: any): string[] {
		const w = colWidth - 2;
		const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 3) + "..." : s;

		const statusColor = state.status === "pending" ? "dim"
			: state.status === "running" ? "accent"
			: state.status === "done" ? "success" : "error";
		const statusIcon = state.status === "pending" ? "○"
			: state.status === "running" ? "●"
			: state.status === "done" ? "✓" : "✗";

		const name = displayName(state.agent);
		const nameStr = theme.fg("accent", theme.bold(truncate(name, w)));
		const nameVisible = Math.min(name.length, w);

		const statusStr = `${statusIcon} ${state.status}`;
		const timeStr = state.status !== "pending" ? ` ${Math.round(state.elapsed / 1000)}s` : "";
		const statusLine = theme.fg(statusColor, statusStr + timeStr);
		const statusVisible = statusStr.length + timeStr.length;

		const workRaw = state.lastWork || "";
		const workText = workRaw ? truncate(workRaw, Math.min(50, w - 1)) : "";
		const workLine = workText ? theme.fg("muted", workText) : theme.fg("dim", "—");
		const workVisible = workText ? workText.length : 1;

		const top = "┌" + "─".repeat(w) + "┐";
		const bot = "└" + "─".repeat(w) + "┘";
		const border = (content: string, visLen: number) =>
			theme.fg("dim", "│") + content + " ".repeat(Math.max(0, w - visLen)) + theme.fg("dim", "│");

		return [
			theme.fg("dim", top),
			border(" " + nameStr, 1 + nameVisible),
			border(" " + statusLine, 1 + statusVisible),
			border(" " + workLine, 1 + workVisible),
			theme.fg("dim", bot),
		];
	}

	function updateWidget() {
		if (!widgetCtx) return;

		widgetCtx.ui.setWidget("agent-chain", (_tui: any, theme: any) => {
			const text = new Text("", 0, 1);

			return {
				render(width: number): string[] {
					if (!activeChain || stepStates.length === 0) {
						text.setText(theme.fg("dim", "No chain active. Use /chain to select one."));
						return text.render(width);
					}

					const arrowWidth = 5; // " ──▶ "
					const cols = stepStates.length;
					const totalArrowWidth = arrowWidth * (cols - 1);
					const colWidth = Math.max(12, Math.floor((width - totalArrowWidth) / cols));
					const arrowRow = 2; // middle of 5-line card (0-indexed)

					const cards = stepStates.map(s => renderCard(s, colWidth, theme));
					const cardHeight = cards[0].length;
					const outputLines: string[] = [];

					for (let line = 0; line < cardHeight; line++) {
						let row = cards[0][line];
						for (let c = 1; c < cols; c++) {
							if (line === arrowRow) {
								row += theme.fg("dim", " ──▶ ");
							} else {
								row += " ".repeat(arrowWidth);
							}
							row += cards[c][line];
						}
						outputLines.push(row);
					}

					text.setText(outputLines.join("\n"));
					return text.render(width);
				},
				invalidate() {
					text.invalidate();
				},
			};
		});
	}

	// ── Run Agent (subprocess) ──────────────────

	function runAgent(
		agentDef: AgentDef,
		task: string,
		stepIndex: number,
		_ctx: any,
	): Promise<{ output: string; exitCode: number; elapsed: number }> {
		const model = CURSOR_MODEL;

		const agentKey = agentDef.name.toLowerCase().replace(/\s+/g, "-");
		const agentSessionFile = join(sessionDir, `chain-${agentKey}.json`);
		const hasSession = agentSessions.get(agentKey);

		const args = [
			"--mode", "json",
			"-p",
			"--no-extensions",
			"--extension", CURSOR_SDK_EXTENSION,
			...CURSOR_FAST_FLAGS,
			"--model", model,
			"--tools", agentDef.tools,
			"--thinking", "off",
			"--append-system-prompt", agentDef.systemPrompt,
			"--session", agentSessionFile,
		];

		if (hasSession) {
			args.push("-c");
		}

		args.push(task);

		const textChunks: string[] = [];
		const startTime = Date.now();
		const state = stepStates[stepIndex];

		return new Promise((resolve) => {
				const proc = spawn(resolvePiBinary(), args, {
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			});

			const timer = setInterval(() => {
				state.elapsed = Date.now() - startTime;
				updateWidget();
			}, 1000);

			let buffer = "";

			proc.stdout!.setEncoding("utf-8");
			proc.stdout!.on("data", (chunk: string) => {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const event = JSON.parse(line);
						if (event.type === "message_update") {
							const delta = event.assistantMessageEvent;
							if (delta?.type === "text_delta") {
								textChunks.push(delta.delta || "");
								const full = textChunks.join("");
								const last = full.split("\n").filter((l: string) => l.trim()).pop() || "";
								state.lastWork = last;
								updateWidget();
							}
						}
					} catch {}
				}
			});

			proc.stderr!.setEncoding("utf-8");
			proc.stderr!.on("data", () => {});

			proc.on("close", (code) => {
				if (buffer.trim()) {
					try {
						const event = JSON.parse(buffer);
						if (event.type === "message_update") {
							const delta = event.assistantMessageEvent;
							if (delta?.type === "text_delta") textChunks.push(delta.delta || "");
						}
					} catch {}
				}

				clearInterval(timer);
				const elapsed = Date.now() - startTime;
				state.elapsed = elapsed;
				const output = textChunks.join("");
				state.lastWork = output.split("\n").filter((l: string) => l.trim()).pop() || "";

				if (code === 0) {
					agentSessions.set(agentKey, agentSessionFile);
				}

				resolve({ output, exitCode: code ?? 1, elapsed });
			});

			proc.on("error", (err) => {
				clearInterval(timer);
				resolve({
					output: `Error spawning agent: ${err.message}`,
					exitCode: 1,
					elapsed: Date.now() - startTime,
				});
			});
		});
	}

	// ── Run Chain (sequential pipeline) ─────────

	async function runChain(
		task: string,
		ctx: any,
	): Promise<{ output: string; success: boolean; elapsed: number }> {
		if (!activeChain) {
			return { output: "No chain active", success: false, elapsed: 0 };
		}

		const chainStart = Date.now();

		// Reset all steps to pending
		stepStates = activeChain.steps.map(s => ({
			agent: s.agent,
			status: "pending" as const,
			elapsed: 0,
			lastWork: "",
		}));
		updateWidget();

		let input = task;
		const originalPrompt = task;

		for (let i = 0; i < activeChain.steps.length; i++) {
			const step = activeChain.steps[i];
			stepStates[i].status = "running";
			updateWidget();

			const resolvedPrompt = step.prompt
				.replace(/\$INPUT/g, input)
				.replace(/\$ORIGINAL/g, originalPrompt);

			const agentDef = allAgents.get(step.agent.toLowerCase());
			if (!agentDef) {
				stepStates[i].status = "error";
				stepStates[i].lastWork = `Agent "${step.agent}" not found`;
				updateWidget();
				return {
					output: `Error at step ${i + 1}: Agent "${step.agent}" not found. Available: ${Array.from(allAgents.keys()).join(", ")}`,
					success: false,
					elapsed: Date.now() - chainStart,
				};
			}

			const result = await runAgent(agentDef, resolvedPrompt, i, ctx);

			if (result.exitCode !== 0) {
				stepStates[i].status = "error";
				updateWidget();
				return {
					output: `Error at step ${i + 1} (${step.agent}): ${result.output}`,
					success: false,
					elapsed: Date.now() - chainStart,
				};
			}

			stepStates[i].status = "done";
			updateWidget();

			input = result.output;
		}

		return { output: input, success: true, elapsed: Date.now() - chainStart };
	}

	// ── run_chain Tool ──────────────────────────

	pi.registerTool({
		name: "run_chain",
		label: "Run Chain",
		description: "Execute the active agent chain pipeline. Each step runs sequentially — output from one step feeds into the next. Agents maintain session context across runs.",
		parameters: Type.Object({
			task: Type.String({ description: "The task/prompt for the chain to process" }),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const { task } = params as { task: string };

			if (!chainMode) {
				return {
					content: [{ type: "text", text: "Agent Chain is installed but inactive. Use /chain-mode or /chain-run <task> to run a pipeline." }],
					details: { chain: activeChain?.name, task, status: "inactive", elapsed: 0, fullOutput: "" },
				};
			}

			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Starting chain: ${activeChain?.name}...` }],
					details: { chain: activeChain?.name, task, status: "running" },
				});
			}

			const result = await runChain(task, ctx);

			const truncated = result.output.length > 8000
				? result.output.slice(0, 8000) + "\n\n... [truncated]"
				: result.output;

			const status = result.success ? "done" : "error";
			const summary = `[chain:${activeChain?.name}] ${status} in ${Math.round(result.elapsed / 1000)}s`;

			return {
				content: [{ type: "text", text: `${summary}\n\n${truncated}` }],
				details: {
					chain: activeChain?.name,
					task,
					status,
					elapsed: result.elapsed,
					fullOutput: result.output,
				},
			};
		},

		renderCall(args, theme) {
			const task = (args as any).task || "";
			const preview = task.length > 60 ? task.slice(0, 57) + "..." : task;
			return new Text(
				theme.fg("toolTitle", theme.bold("run_chain ")) +
				theme.fg("accent", activeChain?.name || "?") +
				theme.fg("dim", " — ") +
				theme.fg("muted", preview),
				0, 0,
			);
		},

		renderResult(result, options, theme) {
			const details = result.details as any;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (options.isPartial || details.status === "running") {
				return new Text(
					theme.fg("accent", `● ${details.chain || "chain"}`) +
					theme.fg("dim", " running..."),
					0, 0,
				);
			}

			const icon = details.status === "done" ? "✓" : "✗";
			const color = details.status === "done" ? "success" : "error";
			const elapsed = typeof details.elapsed === "number" ? Math.round(details.elapsed / 1000) : 0;
			const header = theme.fg(color, `${icon} ${details.chain}`) +
				theme.fg("dim", ` ${elapsed}s`);

			if (options.expanded && details.fullOutput) {
				const output = details.fullOutput.length > 4000
					? details.fullOutput.slice(0, 4000) + "\n... [truncated]"
					: details.fullOutput;
				return new Text(header + "\n" + theme.fg("muted", output), 0, 0);
			}

			return new Text(header, 0, 0);
		},
	});

	// ── Commands ─────────────────────────────────

	pi.registerCommand("chain", {
		description: "Switch active chain",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			if (chains.length === 0) {
				ctx.ui.notify("No chains defined in .pi/agents/agent-chain.yaml", "warning");
				return;
			}

			const options = chains.map(c => {
				const steps = c.steps.map(s => displayName(s.agent)).join(" → ");
				const desc = c.description ? ` — ${c.description}` : "";
				return `${c.name}${desc} (${steps})`;
			});

			const choice = await ctx.ui.select("Select Chain", options);
			if (choice === undefined) return;

			const idx = options.indexOf(choice);
			activateChain(chains[idx]);
			const flow = chains[idx].steps.map(s => displayName(s.agent)).join(" → ");
			ctx.ui.setStatus("agent-chain", `Chain: ${chains[idx].name} (${chains[idx].steps.length} steps)`);
			ctx.ui.notify(
				`Chain: ${chains[idx].name}\n${chains[idx].description}\n${flow}`,
				"info",
			);
		},
	});

	pi.registerCommand("chain-mode", {
		description: "Dispatcher mode — run_chain only (default)",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			applyChainMode(ctx);
			ctx.ui.notify(
				`Chain mode: dispatcher will call run_chain for tasks.\nActive chain: ${activeChain?.name ?? "none"}`,
				"info",
			);
		},
	});

	pi.registerCommand("direct", {
		description: "Direct mode — full tools for quick one-off work",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			applyDirectMode(ctx);
			ctx.ui.notify(
				"Direct mode: full tools enabled. Use /chain-mode to return to pipeline dispatch.",
				"info",
			);
		},
	});

	pi.registerCommand("chain-run", {
		description: "Run the active chain on a task (same as sending the task in chain mode)",
		handler: async (args, ctx) => {
			widgetCtx = ctx;
			const task = args?.trim();
			if (!task) {
				ctx.ui.notify("Usage: /chain-run <task>", "warning");
				return;
			}
			if (!activeChain) {
				ctx.ui.notify("No active chain. Use /chain first.", "warning");
				return;
			}
			applyChainMode(ctx);
			await pi.sendUserMessage(
				`Run the active chain (${activeChain.name}) on this task:\n\n${task}`,
				{ deliverAs: "followUp" },
			);
		},
	});

	pi.registerCommand("chain-list", {
		description: "List all available chains",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			if (chains.length === 0) {
				ctx.ui.notify("No chains defined in .pi/agents/agent-chain.yaml", "warning");
				return;
			}

			const list = chains.map(c => {
				const desc = c.description ? `  ${c.description}` : "";
				const steps = c.steps.map((s, i) =>
					`  ${i + 1}. ${displayName(s.agent)}`
				).join("\n");
				return `${c.name}:${desc ? "\n" + desc : ""}\n${steps}`;
			}).join("\n\n");

			ctx.ui.notify(list, "info");
		},
	});

	// ── System Prompt Override ───────────────────

	pi.on("before_agent_start", async (event, _ctx) => {
		lastUserPrompt = event.prompt;
		chainRanThisTurn = false;

		// Force widget reset on first turn after /new
		if (pendingReset && activeChain) {
			pendingReset = false;
			widgetCtx = _ctx;
			stepStates = activeChain.steps.map(s => ({
				agent: s.agent,
				status: "pending" as const,
				elapsed: 0,
				lastWork: "",
			}));
			updateWidget();
		}

			if (!activeChain) return {};
			if (!chainMode) return {};

			return { systemPrompt: buildDispatcherSystemPrompt() };
		});

	pi.on("tool_execution_start", async (event) => {
		if (event.toolName === "run_chain") chainRanThisTurn = true;
	});

		pi.on("agent_end", async (_event, ctx) => {
			if (!chainMode || !activeChain || chainRanThisTurn) return;
		if (!lastUserPrompt.trim()) return;

		ctx.ui.notify(
			"Pipeline was not run (run_chain was not called). Use /chain-mode and send the task again, or /chain-run <task>.",
			"warning",
		);

		if (process.env.PI_CHAIN_ENFORCE === "1") {
			await pi.sendUserMessage(
				`You must call run_chain now for this task. Do not use other tools.\n\nTask:\n${lastUserPrompt}`,
				{ deliverAs: "followUp" },
			);
		}
	});

	// ── Session Start ───────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		applyExtensionDefaults(import.meta.url, _ctx);
		// Clear widget with both old and new ctx — one of them will be valid
		if (widgetCtx) {
			widgetCtx.ui.setWidget("agent-chain", undefined);
		}
		_ctx.ui.setWidget("agent-chain", undefined);
		widgetCtx = _ctx;

		// Reset execution state — widget re-registration deferred to before_agent_start
		stepStates = [];
		activeChain = null;
		pendingReset = true;

		// Wipe chain session files — reset agent context on /new and launch
		const sessDir = join(_ctx.cwd, ".pi", "agent-sessions");
		if (existsSync(sessDir)) {
			for (const f of readdirSync(sessDir)) {
				if (f.startsWith("chain-") && f.endsWith(".json")) {
					try { unlinkSync(join(sessDir, f)); } catch {}
				}
			}
		}

			// Reload chains + clear agentSessions map (all agents start fresh)
			loadChains(_ctx.cwd);

		if (chains.length === 0) {
			_ctx.ui.notify("No chains found in .pi/agents/agent-chain.yaml", "warning");
			return;
		}

			allToolNames = pi.getAllTools().map((t) => t.name);

			const defaultChain = resolveDefaultChain(_ctx);
			if (defaultChain) activateChain(defaultChain);

			if (process.env.PI_POWERPACK_BOOT_NOTICES === "1") {
				const flow = activeChain!.steps.map(s => displayName(s.agent)).join(" → ");
				_ctx.ui.notify(
					`Agent Chain ready: ${activeChain!.name}\n${activeChain!.description}\n${flow}\n\n` +
					`Use /chain-mode or /chain-run <task> when you want the dispatcher pipeline.\n\n` +
					`/chain             Switch chain\n` +
					`/chain-list        List chains\n` +
					`/chain-mode        Dispatcher mode\n` +
					`/direct            Full tools\n` +
					`/chain-run <task>  Run pipeline on task`,
					"info",
				);
			}
		});

		function installFooter(ctx: any) {
			if (!ctx) return;
			ctx.ui.setFooter((_tui: any, theme: any, _footerData: any) => ({
				dispose: () => {},
				invalidate() {},
				render(width: number): string[] {
					const model = ctx.model?.id || "no-model";
					const usage = ctx.getContextUsage();
					const pct = usage ? usage.percent : 0;
					const filled = Math.round(pct / 10);
					const bar = "#".repeat(filled) + "-".repeat(10 - filled);

				const chainLabel = activeChain
					? theme.fg("accent", activeChain.name)
					: theme.fg("dim", "no chain");

				const left = theme.fg("dim", ` ${model}`) +
					theme.fg("muted", " · ") +
					chainLabel;
				const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

					return [truncateToWidth(left + pad + right, width)];
				},
			}));
		}
	}
