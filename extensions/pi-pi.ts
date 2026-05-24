/**
 * Pi Pi — Meta-agent that builds Pi agents
 *
 * A team of domain-specific research experts (extensions, themes, skills,
 * settings, TUI) operate in PARALLEL to gather documentation and patterns.
 * The primary agent synthesizes their findings and WRITES the actual files.
 *
 * Each expert fetches fresh Pi documentation via firecrawl on first query.
 * Experts are read-only researchers. The primary agent is the only writer.
 *
 * Commands:
 *   /experts          — list available experts and their status
 *   /experts-grid N   — set dashboard column count (default 3)
 *
 * Usage: pi -e extensions/pi-pi.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { applyExtensionDefaults } from "./themeMap.ts";
import { piAgentHome, powerpackAgentsDir } from "./powerpackPaths.ts";
import { runSpecialistSpawn } from "./lib/specialistSpawn.ts";
import { loadPiPiExperts, displayName } from "./lib/agentDefinitions.ts";
import { installRawWorkflowGrid } from "./lib/workflowGrid.ts";
import {
	renderStatusCard,
	installContextFooter,
	renderToolCallLine,
	truncateText,
	lastNonEmptyLine,
	type StatusValue,
} from "./lib/workflowKit.ts";

const PACKAGE_AGENTS_DIR = powerpackAgentsDir(import.meta.url);

// ── Types ────────────────────────────────────────

interface ExpertDef {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
	file: string;
}

interface ExpertState {
	def: ExpertDef;
	status: "idle" | "researching" | "done" | "error";
	question: string;
	elapsed: number;
	lastLine: string;
	queryCount: number;
	timer?: ReturnType<typeof setInterval>;
}

// ── Helpers ──────────────────────────────────────

// ── Expert card colors ────────────────────────────
// Each expert gets a unique hue: bg fills the card interior,
// br is the matching border foreground (brighter shade of same hue).
const EXPERT_COLORS: Record<string, { bg: string; br: string }> = {
	"agent-expert":      { bg: "\x1b[48;2;20;30;75m",  br: "\x1b[38;2;70;110;210m"  }, // navy
	"config-expert":     { bg: "\x1b[48;2;18;65;30m",  br: "\x1b[38;2;55;175;90m"   }, // forest
	"ext-expert":        { bg: "\x1b[48;2;80;18;28m",  br: "\x1b[38;2;210;65;85m"   }, // crimson
	"keybinding-expert": { bg: "\x1b[48;2;50;22;85m",  br: "\x1b[38;2;145;80;220m"  }, // violet
	"prompt-expert":     { bg: "\x1b[48;2;80;55;12m",  br: "\x1b[38;2;215;150;40m"  }, // amber
	"skill-expert":      { bg: "\x1b[48;2;12;65;75m",  br: "\x1b[38;2;40;175;195m"  }, // teal
	"theme-expert":      { bg: "\x1b[48;2;80;18;62m",  br: "\x1b[38;2;210;55;160m"  }, // rose
	"tui-expert":        { bg: "\x1b[48;2;28;42;80m",  br: "\x1b[38;2;85;120;210m"  }, // slate
	"cli-expert":        { bg: "\x1b[48;2;60;80;20m",  br: "\x1b[38;2;160;210;55m"  }, // olive/lime
};

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
		const experts: Map<string, ExpertState> = new Map();
		let gridCols = 3;
		let widgetCtx: any;
		let piPiMode = false;
		let allToolNames: string[] = [];

		function loadExperts(cwd: string) {
			const loaded = loadPiPiExperts(cwd, PACKAGE_AGENTS_DIR);
			experts.clear();
			for (const [key, def] of loaded) {
				experts.set(key, {
					def: {
						name: def.name,
						description: def.description,
						tools: def.tools,
						systemPrompt: def.systemPrompt,
						file: def.filePath,
					},
					status: experts.get(key)?.status ?? "idle",
					question: experts.get(key)?.question ?? "",
					elapsed: experts.get(key)?.elapsed ?? 0,
					lastLine: experts.get(key)?.lastLine ?? "",
					queryCount: experts.get(key)?.queryCount ?? 0,
				});
			}
		}

	// ── Grid Rendering ───────────────────────────

	function renderCard(state: ExpertState, colWidth: number, theme: any): string[] {
		const lastRaw = state.lastLine || "";
		const lastText = truncateText(lastRaw, Math.min(50, colWidth - 3));
		const lastLineRendered = lastText ? theme.fg("dim", lastText) : theme.fg("dim", "—");
		const lastVisible = lastText ? lastText.length : 1;

		const colors = EXPERT_COLORS[state.def.name];

		return renderStatusCard({
			name: displayName(state.def.name),
			status: state.status as StatusValue,
			elapsed: state.elapsed,
			workText: state.question || state.def.description,
			theme,
			colWidth,
			borderColors: colors,
			extraLines: [{ text: lastLineRendered, visibleLen: lastVisible }],
		});
	}

	function updateWidget() {
		installRawWorkflowGrid({
			widgetKey: "pi-pi-grid",
			getUi: () => widgetCtx?.ui ?? null,
			getItems: () => Array.from(experts.values()),
			getCols: () => gridCols,
			renderCard: (state, colWidth, theme) => renderCard(state as ExpertState, colWidth, theme),
			emptyLine: (theme) =>
				(theme as { fg: (c: string, s: string) => string }).fg(
					"dim",
					"  No experts found. Add agent .md files to .pi/agents/pi-pi/",
				),
		});
	}

	// ── Query Expert ─────────────────────────────

	function queryExpert(
		expertName: string,
		question: string,
		ctx: any,
	): Promise<{ output: string; exitCode: number; elapsed: number }> {
		const key = expertName.toLowerCase();
		const state = experts.get(key);
		if (!state) {
			return Promise.resolve({
				output: `Expert "${expertName}" not found. Available: ${Array.from(experts.values()).map(s => s.def.name).join(", ")}`,
				exitCode: 1,
				elapsed: 0,
			});
		}

		if (state.status === "researching") {
			return Promise.resolve({
				output: `Expert "${displayName(state.def.name)}" is already researching. Wait for it to finish.`,
				exitCode: 1,
				elapsed: 0,
			});
		}

		state.status = "researching";
		state.question = question;
		state.elapsed = 0;
		state.lastLine = "";
		state.queryCount++;
		updateWidget();

		return runSpecialistSpawn(
			import.meta.url,
			{
				task: question,
				tools: state.def.tools,
				systemPrompt: state.def.systemPrompt,
				ephemeral: true,
			},
			{
				onTextDelta: (_delta, _full, lastLine) => {
					state.lastLine = lastLine;
					updateWidget();
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
			state.lastLine = lastNonEmptyLine(output);
			updateWidget();
			ctx.ui.notify(
				`${displayName(state.def.name)} ${state.status} in ${Math.round(state.elapsed / 1000)}s`,
				state.status === "done" ? "info" : "error",
			);
			return { output, exitCode, elapsed: state.elapsed };
		});
	}

	// ── query_experts Tool (parallel) ───────────

	pi.registerTool({
		name: "query_experts",
		label: "Query Experts",
		description: `Query one or more Pi domain experts IN PARALLEL. All experts run simultaneously as concurrent subprocesses.

Pass an array of queries — each with an expert name and a specific question. All experts start at the same time and their results are returned together.

Available experts:
- ext-expert: Extensions — tools, events, commands, rendering, state management
- theme-expert: Themes — JSON format, 51 color tokens, vars, color values
- skill-expert: Skills — SKILL.md multi-file packages, scripts, references, frontmatter
- config-expert: Settings — settings.json, providers, models, packages, keybindings
- tui-expert: TUI — components, keyboard input, overlays, widgets, footers, editors
- prompt-expert: Prompt templates — single-file .md commands, arguments ($1, $@)
- agent-expert: Agent definitions — .md personas, tools, teams.yaml, orchestration
- cli-expert: CLI flags, env vars, entrypoints
- keybinding-expert: Keyboard shortcuts — registerShortcut(), Key IDs, reserved keys

Ask specific questions about what you need to BUILD. Each expert will return documentation excerpts, code patterns, and implementation guidance.`,

		parameters: Type.Object({
			queries: Type.Array(
				Type.Object({
					expert: Type.String({
						description:
							"Expert name: ext-expert, theme-expert, skill-expert, config-expert, tui-expert, prompt-expert, agent-expert, cli-expert, or keybinding-expert",
					}),
					question: Type.String({
						description: "Specific question about what you need to build. Include context about the target component.",
					}),
				}),
				{ description: "Array of expert queries to run in parallel" },
			),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const { queries } = params as { queries: { expert: string; question: string }[] };

			if (!piPiMode) {
				return {
					content: [{ type: "text", text: "Pi Pi experts are installed but inactive. Use /pi-pi-mode before querying experts." }],
					details: { results: [], status: "inactive" },
				};
			}

			if (!queries || queries.length === 0) {
				return {
					content: [{ type: "text", text: "No queries provided." }],
					details: { results: [], status: "error" },
				};
			}

			const names = queries.map(q => displayName(q.expert)).join(", ");
			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Querying ${queries.length} experts in parallel: ${names}` }],
					details: { queries, status: "researching", results: [] },
				});
			}

			// Launch ALL experts concurrently — allSettled so one failure
			// never discards results from the others
			const settled = await Promise.allSettled(
				queries.map(async ({ expert, question }) => {
					const result = await queryExpert(expert, question, ctx);
					const truncated = result.output.length > 12000
						? result.output.slice(0, 12000) + "\n\n... [truncated — ask follow-up for more]"
						: result.output;
					const status = result.exitCode === 0 ? "done" : "error";
					return {
						expert,
						question,
						status,
						elapsed: result.elapsed,
						exitCode: result.exitCode,
						output: truncated,
						fullOutput: result.output,
					};
				}),
			);

			const results = settled.map((s, i) =>
				s.status === "fulfilled"
					? s.value
					: {
						expert: queries[i].expert,
						question: queries[i].question,
						status: "error" as const,
						elapsed: 0,
						exitCode: 1,
						output: `Error: ${(s.reason as any)?.message || s.reason}`,
						fullOutput: "",
					},
			);

			// Build combined response
			const sections = results.map(r => {
				const icon = r.status === "done" ? "✓" : "✗";
				return `## [${icon}] ${displayName(r.expert)} (${Math.round(r.elapsed / 1000)}s)\n\n${r.output}`;
			});

			return {
				content: [{ type: "text", text: sections.join("\n\n---\n\n") }],
				details: {
					results,
					status: results.every(r => r.status === "done") ? "done" : "partial",
				},
			};
		},

		renderCall(args, theme) {
			const queries = (args as any).queries || [];
			const names = queries.map((q: any) => displayName(q.expert || "?")).join(", ");
			return renderToolCallLine(theme, "query_experts", `${queries.length} parallel`, names);
		},

		renderResult(result, options, theme) {
			const details = result.details as any;
			if (!details?.results) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (options.isPartial || details.status === "researching") {
				const count = details.queries?.length || "?";
				return new Text(
					theme.fg("accent", `◉ ${count} experts`) +
					theme.fg("dim", " researching in parallel..."),
					0, 0,
				);
			}

			const lines = (details.results as any[]).map((r: any) => {
				const icon = r.status === "done" ? "✓" : "✗";
				const color = r.status === "done" ? "success" : "error";
				const elapsed = typeof r.elapsed === "number" ? Math.round(r.elapsed / 1000) : 0;
				return theme.fg(color, `${icon} ${displayName(r.expert)}`) +
					theme.fg("dim", ` ${elapsed}s`);
			});

			const header = lines.join(theme.fg("dim", " · "));

			if (options.expanded && details.results) {
				const expanded = (details.results as any[]).map((r: any) => {
					const output = r.fullOutput
						? (r.fullOutput.length > 4000 ? r.fullOutput.slice(0, 4000) + "\n... [truncated]" : r.fullOutput)
						: r.output || "";
					return theme.fg("accent", `── ${displayName(r.expert)} ──`) + "\n" + theme.fg("muted", output);
				});
				return new Text(header + "\n\n" + expanded.join("\n\n"), 0, 0);
			}

			return new Text(header, 0, 0);
		},
	});

		// ── Commands ─────────────────────────────────

		function installFooter(ctx: any) {
			installContextFooter(ctx, "Pi Pi");
		}

		function enablePiPiMode(ctx: any) {
			piPiMode = true;
			pi.setActiveTools(["read", "write", "edit", "bash", "grep", "find", "ls", "query_experts"]);
			ctx.ui.setStatus("pi-pi", `Pi Pi (${experts.size} experts)`);
			updateWidget();
			installFooter(ctx);
		}

		function disablePiPiMode(ctx: any) {
			piPiMode = false;
			if (allToolNames.length > 0) {
				pi.setActiveTools(allToolNames);
			}
			ctx.ui.setStatus("pi-pi", undefined);
			ctx.ui.setWidget("pi-pi-grid", undefined);
			ctx.ui.setFooter(undefined);
		}

		pi.registerCommand("pi-pi-mode", {
			description: "Activate Pi Pi expert-builder mode",
			handler: async (_args, ctx) => {
				widgetCtx = ctx;
				if (experts.size === 0) {
					ctx.ui.notify("No Pi Pi experts loaded.", "warning");
					return;
				}
				enablePiPiMode(ctx);
				const expertNames = Array.from(experts.values()).map(s => displayName(s.def.name)).join(", ");
				ctx.ui.notify(`Pi Pi mode on — ${experts.size} experts: ${expertNames}`, "info");
			},
		});

		pi.registerCommand("pi-pi-off", {
			description: "Deactivate Pi Pi expert-builder mode",
			handler: async (_args, ctx) => {
				widgetCtx = ctx;
				disablePiPiMode(ctx);
				ctx.ui.notify("Pi Pi mode off.", "info");
			},
		});

		pi.registerCommand("experts", {
			description: "List available Pi Pi experts and their status",
		handler: async (_args, _ctx) => {
			widgetCtx = _ctx;
			const lines = Array.from(experts.values())
				.map(s => `${displayName(s.def.name)} (${s.status}, queries: ${s.queryCount}): ${s.def.description}`)
				.join("\n");
			_ctx.ui.notify(lines || "No experts loaded", "info");
		},
	});

	pi.registerCommand("experts-grid", {
		description: "Set expert grid columns: /experts-grid <1-5>",
		handler: async (args, _ctx) => {
			widgetCtx = _ctx;
			const n = parseInt(args?.trim() || "", 10);
			if (n >= 1 && n <= 5) {
				gridCols = n;
				_ctx.ui.notify(`Grid set to ${gridCols} columns`, "info");
				updateWidget();
			} else {
				_ctx.ui.notify("Usage: /experts-grid <1-5>", "error");
			}
		},
	});

	// ── System Prompt ────────────────────────────

		pi.on("before_agent_start", async (_event, _ctx) => {
			if (!piPiMode) return {};

			const expertCatalog = Array.from(experts.values())
			.map(s => `### ${displayName(s.def.name)}\n**Query as:** \`${s.def.name}\`\n${s.def.description}`)
			.join("\n\n");

		const expertNames = Array.from(experts.values()).map(s => displayName(s.def.name)).join(", ");

			const projectOrchestratorPath = join(_ctx.cwd, ".pi", "agents", "pi-pi", "pi-orchestrator.md");
			const globalOrchestratorPath = join(piAgentHome(), "agents", "pi-pi", "pi-orchestrator.md");
			const packageOrchestratorPath = join(PACKAGE_AGENTS_DIR, "pi-pi", "pi-orchestrator.md");
			const orchestratorPath = existsSync(projectOrchestratorPath)
				? projectOrchestratorPath
				: existsSync(globalOrchestratorPath)
				? globalOrchestratorPath
				: packageOrchestratorPath;
		let systemPrompt = "";
		try {
			const raw = readFileSync(orchestratorPath, "utf-8");
			const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
			const template = match ? match[2].trim() : raw;
			
			systemPrompt = template
				.replace("{{EXPERT_COUNT}}", experts.size.toString())
				.replace("{{EXPERT_NAMES}}", expertNames)
				.replace("{{EXPERT_CATALOG}}", expertCatalog);
		} catch {
			systemPrompt = "Error: Could not load pi-orchestrator.md. Make sure it exists in .pi/agents/pi-pi/.";
		}

		return { systemPrompt };
	});

	// ── Session Start ────────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		applyExtensionDefaults(import.meta.url, _ctx);
		if (widgetCtx) {
			widgetCtx.ui.setWidget("pi-pi-grid", undefined);
		}
			widgetCtx = _ctx;
			allToolNames = pi.getAllTools().map((t) => t.name);

			loadExperts(_ctx.cwd);

			if (process.env.PI_POWERPACK_BOOT_NOTICES === "1") {
				const expertNames = Array.from(experts.values()).map(s => displayName(s.def.name)).join(", ");
				_ctx.ui.notify(
					`Pi Pi ready — ${experts.size} experts: ${expertNames}\n\n` +
					`/pi-pi-mode      Activate expert-builder mode\n` +
					`/pi-pi-off       Deactivate expert-builder mode\n` +
					`/experts          List experts and status\n` +
					`/experts-grid N   Set grid columns (1-5)`,
					"info",
				);
			}
		});
	}
