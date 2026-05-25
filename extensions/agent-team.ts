/**
 * Agent Team — Dispatcher-only orchestrator with grid dashboard
 *
 * The primary Pi agent has NO codebase tools. It can ONLY delegate work
 * to specialist agents via the `dispatch_agent` tool. Each specialist
 * maintains its own Pi session for cross-invocation memory.
 *
 * Loads agent definitions from agents/*.md, .claude/agents/*.md, .pi/agents/*.md.
 * Teams are defined in .pi/agents/teams.yaml — on boot a select dialog lets
 * you pick which team to work with. Only team members are available for dispatch.
 *
 * Commands:
 *   /agents-team          — switch active team
 *   /agents-list          — list loaded agents
 *   /agents-grid N        — set column count (default 2)
 *
 * Usage: pi -e extensions/agent-team.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text, type AutocompleteItem } from "@earendil-works/pi-tui";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnChildAgent } from "./lib/childAgentSession.ts";
import { installRawWorkflowGrid } from "./lib/workflowGrid.ts";
import { applyExtensionDefaults } from "./themeMap.ts";
import { piAgentHome, powerpackAgentsDir } from "./powerpackPaths.ts";
import {
	scanAgents,
	loadTeamsYaml,
	mergeTeams,
	displayName,
	type AgentDef,
} from "./lib/agentDefinitions.ts";
import {
	renderStatusCard,
	installContextFooter,
	renderToolCallLine,
	truncateOutput,
	truncateText,
	lastNonEmptyLine,
	clearSessionFiles,
	type StatusValue,
} from "./lib/workflowKit.ts";

const PACKAGE_AGENTS_DIR = powerpackAgentsDir(import.meta.url);

// ── Types ────────────────────────────────────────

interface AgentState {
	def: AgentDef;
	status: "idle" | "running" | "done" | "error";
	task: string;
	toolCount: number;
	elapsed: number;
	lastWork: string;
	contextPct: number;
	sessionFile: string | null;
	runCount: number;
	timer?: ReturnType<typeof setInterval>;
}

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const agentStates: Map<string, AgentState> = new Map();
	let allAgentDefs: AgentDef[] = [];
	let teams: Record<string, string[]> = {};
	let activeTeamName = "";
		let gridCols = 2;
		let widgetCtx: any;
		let sessionDir = "";
		let contextWindow = 0;
		let teamMode = false;
		let allToolNames: string[] = [];

	function loadAgents(cwd: string) {
		// Create session storage dir
		sessionDir = join(cwd, ".pi", "agent-sessions");
		if (!existsSync(sessionDir)) {
			mkdirSync(sessionDir, { recursive: true });
		}

		// Load all agent definitions
		allAgentDefs = Array.from(
			scanAgents({ cwd, packageAgentsDir: PACKAGE_AGENTS_DIR, includePiPiSubdir: true }).values(),
		);

		// Load teams from project config first, then the Pi-global curated setup.
			const packageTeamsPath = join(PACKAGE_AGENTS_DIR, "teams.yaml");
			const globalTeamsPath = join(piAgentHome(), "agents", "teams.yaml");
			const projectTeamsPath = join(cwd, ".pi", "agents", "teams.yaml");
			teams = {};
			if (existsSync(packageTeamsPath)) {
				try {
					teams = mergeTeams(teams, loadTeamsYaml(readFileSync(packageTeamsPath, "utf-8")));
				} catch {
					// keep any teams loaded so far
				}
			}
			if (existsSync(globalTeamsPath)) {
				try {
					teams = mergeTeams(teams, loadTeamsYaml(readFileSync(globalTeamsPath, "utf-8")));
				} catch {
					// keep package teams
				}
			}
			if (existsSync(projectTeamsPath)) {
				try {
					teams = mergeTeams(teams, loadTeamsYaml(readFileSync(projectTeamsPath, "utf-8")));
				} catch {
					// keep package/global teams
				}
			}

		// If no teams defined, create a default "all" team
		if (Object.keys(teams).length === 0) {
			teams = { all: allAgentDefs.map(d => d.name) };
		}
	}

	function activateTeam(teamName: string) {
		activeTeamName = teamName;
		const members = teams[teamName] || [];
		const defsByName = new Map(allAgentDefs.map(d => [d.name.toLowerCase(), d]));

		agentStates.clear();
		for (const member of members) {
			const def = defsByName.get(member.toLowerCase());
			if (!def) continue;
			const key = def.name.toLowerCase().replace(/\s+/g, "-");
			const sessionFile = join(sessionDir, `team-${key}.json`);
			agentStates.set(def.name.toLowerCase(), {
				def,
				status: "idle",
				task: "",
				toolCount: 0,
				elapsed: 0,
				lastWork: "",
				contextPct: 0,
				sessionFile: existsSync(sessionFile) ? sessionFile : null,
				runCount: 0,
			});
		}

		// Auto-size grid columns based on team size
		const size = agentStates.size;
		gridCols = size <= 3 ? size : size === 4 ? 2 : 3;
	}

	// ── Grid Rendering ───────────────────────────

	function renderCard(state: AgentState, colWidth: number, theme: any): string[] {
		const filled = Math.ceil(state.contextPct / 20);
		const bar = "#".repeat(filled) + "-".repeat(5 - filled);
		const ctxStr = `[${bar}] ${Math.ceil(state.contextPct)}%`;

		return renderStatusCard({
			name: displayName(state.def.name),
			status: state.status as StatusValue,
			elapsed: state.elapsed,
			workText: state.task ? (state.lastWork || state.task) : state.def.description,
			theme,
			colWidth,
			extraLines: [{ text: theme.fg("dim", ctxStr), visibleLen: ctxStr.length }],
		});
	}

	function updateWidget() {
		installRawWorkflowGrid({
			widgetKey: "agent-team",
			getUi: () => widgetCtx?.ui ?? null,
			getItems: () => Array.from(agentStates.values()),
			getCols: () => gridCols,
			renderCard: (state, colWidth, theme) => renderCard(state as AgentState, colWidth, theme),
			emptyLine: (theme) =>
				(theme as { fg: (c: string, s: string) => string }).fg(
					"dim",
					"No agents found. Add .md files to agents/",
				),
		});
	}

	// ── Dispatch Agent (returns Promise) ─────────

	function dispatchAgent(
		agentName: string,
		task: string,
		ctx: any,
	): Promise<{ output: string; exitCode: number; elapsed: number }> {
		const key = agentName.toLowerCase();
		const state = agentStates.get(key);
		if (!state) {
			return Promise.resolve({
				output: `Agent "${agentName}" not found. Available: ${Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(", ")}`,
				exitCode: 1,
				elapsed: 0,
			});
		}

		if (state.status === "running") {
			return Promise.resolve({
				output: `Agent "${displayName(state.def.name)}" is already running. Wait for it to finish.`,
				exitCode: 1,
				elapsed: 0,
			});
		}

		state.status = "running";
		state.task = task;
		state.toolCount = 0;
		state.elapsed = 0;
		state.lastWork = "";
		state.runCount++;
		updateWidget();

		const agentKey = state.def.name.toLowerCase().replace(/\s+/g, "-");
		const agentSessionFile = join(sessionDir, `team-${agentKey}.json`);

		return spawnChildAgent(
			import.meta.url,
			{
				task,
				tools: state.def.tools,
				systemPrompt: state.def.systemPrompt,
				sessionFile: agentSessionFile,
				continueSession: Boolean(state.sessionFile),
			},
			{
				onTextDelta: (_delta, _full, lastLine) => {
					state.lastWork = lastLine;
					updateWidget();
				},
				onToolStart: () => {
					state.toolCount++;
					updateWidget();
				},
				onMessageEnd: (usage) => {
					if (usage && contextWindow > 0) {
						state.contextPct = ((usage.input || 0) / contextWindow) * 100;
						updateWidget();
					}
				},
				onAgentEnd: (messages) => {
					const last = [...(messages || [])].reverse().find((m) => m.role === "assistant");
					if (last?.usage && contextWindow > 0) {
						state.contextPct = ((last.usage.input || 0) / contextWindow) * 100;
						updateWidget();
					}
				},
				onTick: (elapsed) => {
					state.elapsed = elapsed;
					updateWidget();
				},
			},
		).then(({ output, exitCode, elapsed }) => {
			if (state.timer) clearInterval(state.timer);
			state.elapsed = elapsed;
			state.status = exitCode === 0 ? "done" : "error";
			if (exitCode === 0) {
				state.sessionFile = agentSessionFile;
			}
			state.lastWork = lastNonEmptyLine(output);
			updateWidget();
			ctx.ui.notify(
				`${displayName(state.def.name)} ${state.status} in ${Math.round(state.elapsed / 1000)}s`,
				state.status === "done" ? "info" : "error",
			);
			return { output, exitCode, elapsed: state.elapsed };
		});
	}

	// ── dispatch_agent Tool (registered at top level) ──

	pi.registerTool({
		name: "dispatch_agent",
		label: "Dispatch Agent",
		description: "Dispatch a task to a specialist agent. The agent will execute the task and return the result. Use the system prompt to see available agent names.",
		parameters: Type.Object({
			agent: Type.String({ description: "Agent name (case-insensitive)" }),
			task: Type.String({ description: "Task description for the agent to execute" }),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const { agent, task } = params as { agent: string; task: string };

			if (!teamMode) {
				return {
					content: [{ type: "text", text: "Agent Team is installed but inactive. Use /agents-mode or /agents-team to dispatch specialist agents." }],
					details: { agent, task, status: "inactive", elapsed: 0, exitCode: 1, fullOutput: "" },
				};
			}

			try {
				if (onUpdate) {
					onUpdate({
						content: [{ type: "text", text: `Dispatching to ${agent}...` }],
						details: { agent, task, status: "dispatching" },
					});
				}

				const result = await dispatchAgent(agent, task, ctx);

				const truncated = truncateOutput(result.output);

				const status = result.exitCode === 0 ? "done" : "error";
				const summary = `[${agent}] ${status} in ${Math.round(result.elapsed / 1000)}s`;

				return {
					content: [{ type: "text", text: `${summary}\n\n${truncated}` }],
					details: {
						agent,
						task,
						status,
						elapsed: result.elapsed,
						exitCode: result.exitCode,
						fullOutput: result.output,
					},
				};
			} catch (err: any) {
				return {
					content: [{ type: "text", text: `Error dispatching to ${agent}: ${err?.message || err}` }],
					details: { agent, task, status: "error", elapsed: 0, exitCode: 1, fullOutput: "" },
				};
			}
		},

		renderCall(args, theme) {
			const agentName = (args as any).agent || "?";
			const task = (args as any).task || "";
			return renderToolCallLine(theme, "dispatch_agent", agentName, truncateText(task, 60));
		},

		renderResult(result, options, theme) {
			const details = result.details as any;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			// Streaming/partial result while agent is still running
			if (options.isPartial || details.status === "dispatching") {
				return new Text(
					theme.fg("accent", `● ${details.agent || "?"}`) +
					theme.fg("dim", " working..."),
					0, 0,
				);
			}

			const icon = details.status === "done" ? "✓" : "✗";
			const color = details.status === "done" ? "success" : "error";
			const elapsed = typeof details.elapsed === "number" ? Math.round(details.elapsed / 1000) : 0;
			const header = theme.fg(color, `${icon} ${details.agent}`) +
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

		function installFooter(ctx: any) {
			installContextFooter(ctx, activeTeamName);
		}

		function enableTeamMode(ctx: any) {
			teamMode = true;
			pi.setActiveTools(["dispatch_agent"]);
			ctx.ui.setStatus("agent-team", `Team: ${activeTeamName} (${agentStates.size})`);
			updateWidget();
			installFooter(ctx);
		}

		function disableTeamMode(ctx: any) {
			teamMode = false;
			if (allToolNames.length > 0) {
				pi.setActiveTools(allToolNames);
			}
			ctx.ui.setStatus("agent-team", undefined);
			ctx.ui.setWidget("agent-team", undefined);
			ctx.ui.setFooter(undefined);
		}

		pi.registerCommand("agents-mode", {
			description: "Activate Agent Team dispatcher mode",
			handler: async (_args, ctx) => {
				widgetCtx = ctx;
				if (agentStates.size === 0) {
					ctx.ui.notify("No agents loaded for the active team.", "warning");
					return;
				}
				enableTeamMode(ctx);
				const members = Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(", ");
				ctx.ui.notify(`Agent Team mode: ${activeTeamName} (${members})`, "info");
			},
		});

		pi.registerCommand("agents-off", {
			description: "Deactivate Agent Team dispatcher mode",
			handler: async (_args, ctx) => {
				widgetCtx = ctx;
				disableTeamMode(ctx);
				ctx.ui.notify("Agent Team mode off.", "info");
			},
		});

		pi.registerCommand("agents-team", {
			description: "Select a team to work with",
			handler: async (_args, ctx) => {
			widgetCtx = ctx;
			const teamNames = Object.keys(teams);
			if (teamNames.length === 0) {
				ctx.ui.notify("No teams defined in .pi/agents/teams.yaml", "warning");
				return;
			}

			const options = teamNames.map(name => {
				const members = teams[name].map(m => displayName(m));
				return `${name} — ${members.join(", ")}`;
			});

			const choice = await ctx.ui.select("Select Team", options);
			if (choice === undefined) return;

				const idx = options.indexOf(choice);
				const name = teamNames[idx];
				activateTeam(name);
				enableTeamMode(ctx);
				ctx.ui.notify(`Team: ${name} — ${Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(", ")}`, "info");
			},
		});

	pi.registerCommand("agents-list", {
		description: "List all loaded agents",
		handler: async (_args, _ctx) => {
			widgetCtx = _ctx;
			const names = Array.from(agentStates.values())
				.map(s => {
					const session = s.sessionFile ? "resumed" : "new";
					return `${displayName(s.def.name)} (${s.status}, ${session}, runs: ${s.runCount}): ${s.def.description}`;
				})
				.join("\n");
			_ctx.ui.notify(names || "No agents loaded", "info");
		},
	});

	pi.registerCommand("agents-grid", {
		description: "Set grid columns: /agents-grid <1-6>",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const items = ["1", "2", "3", "4", "5", "6"].map(n => ({
				value: n,
				label: `${n} columns`,
			}));
			const filtered = items.filter(i => i.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : items;
		},
		handler: async (args, _ctx) => {
			widgetCtx = _ctx;
			const n = parseInt(args?.trim() || "", 10);
			if (n >= 1 && n <= 6) {
				gridCols = n;
				_ctx.ui.notify(`Grid set to ${gridCols} columns`, "info");
				updateWidget();
			} else {
				_ctx.ui.notify("Usage: /agents-grid <1-6>", "error");
			}
		},
	});

	// ── System Prompt Override ───────────────────

		pi.on("before_agent_start", async (_event, _ctx) => {
			if (!teamMode) return {};

			// Build dynamic agent catalog from active team only
			const agentCatalog = Array.from(agentStates.values())
			.map(s => `### ${displayName(s.def.name)}\n**Dispatch as:** \`${s.def.name}\`\n${s.def.description}\n**Tools:** ${s.def.tools}`)
			.join("\n\n");

		const teamMembers = Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(", ");

		return {
			systemPrompt: `You are a dispatcher agent. You coordinate specialist agents to accomplish tasks.
You do NOT have direct access to the codebase. You MUST delegate all work through
agents using the dispatch_agent tool.

## Active Team: ${activeTeamName}
Members: ${teamMembers}
You can ONLY dispatch to agents listed below. Do not attempt to dispatch to agents outside this team.

## How to Work
- Analyze the user's request and break it into clear sub-tasks
- Choose the right agent(s) for each sub-task
- Dispatch tasks using the dispatch_agent tool
- Review results and dispatch follow-up agents if needed
- If a task fails, try a different agent or adjust the task description
- Summarize the outcome for the user

## Rules
- NEVER try to read, write, or execute code directly — you have no such tools
- ALWAYS use dispatch_agent to get work done
- You can chain agents: use scout to explore, then builder to implement
- You can dispatch the same agent multiple times with different tasks
- Keep tasks focused — one clear objective per dispatch

## Agents

${agentCatalog}`,
		};
	});

	// ── Session Start ────────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		applyExtensionDefaults(import.meta.url, _ctx);
		// Clear widgets from previous session
		if (widgetCtx) {
			widgetCtx.ui.setWidget("agent-team", undefined);
		}
		widgetCtx = _ctx;
			contextWindow = _ctx.model?.contextWindow || 0;
			allToolNames = pi.getAllTools().map((t) => t.name);

			clearSessionFiles(join(_ctx.cwd, ".pi", "agent-sessions"), "team-");

		loadAgents(_ctx.cwd);

		// Default to first team — use /agents-team to switch
		const teamNames = Object.keys(teams);
		if (teamNames.length > 0) {
			activateTeam(teamNames[0]);
		}

			if (process.env.PI_POWERPACK_BOOT_NOTICES === "1") {
				const members = Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(", ");
				_ctx.ui.notify(
					`Agent Team ready: ${activeTeamName} (${members})\n` +
					`/agents-mode          Activate team dispatcher\n` +
					`/agents-off           Deactivate team dispatcher\n` +
					`/agents-team          Select a team\n` +
					`/agents-list          List active agents and status\n` +
					`/agents-grid <1-6>    Set grid column count`,
					"info",
				);
			}
		});
	}
