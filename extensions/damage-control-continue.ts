/**
 * Damage-Control (continue) — same rules, but the agent keeps working
 *
 * Difference from damage-control.ts:
 *   - The blocked tool result is replaced with actionable feedback that
 *     distinguishes destructive vs non-destructive intent and tells the
 *     agent how to adapt.
 *   - We do NOT call ctx.abort(), so the agent's turn continues and can
 *     try an alternate path (e.g. assume a .env key exists instead of
 *     reading it to verify).
 *
 * Usage: pi -e extensions/damage-control-continue.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parse as yamlParse } from "yaml";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "os";
import { applyExtensionDefaults } from "./themeMap.ts";
import { powerpackPath } from "./powerpackPaths.ts";
import {
	evaluateToolCall,
	type DamageControlRules,
} from "./lib/damageControlRules.ts";

const SECRET_PATTERN =
	/(api[_-]?key|token|secret|password|bearer|sk-[a-zA-Z0-9]+)\s*[:=]\s*\S+/gi;

/**
 * Redact a tool invocation for safe logging.
 * Returns the log-safe string representation of a tool call,
 * with secrets redacted and long content truncated.
 * When PI_DAMAGE_CONTROL_LOG_RAW=1, returns the raw command/input.
 */
export function redactInvocation(toolName: string, input: unknown): string {
	if (process.env.PI_DAMAGE_CONTROL_LOG_RAW === "1") {
		if (
			toolName === "bash" &&
			input &&
			typeof input === "object" &&
			typeof (input as { command?: unknown }).command === "string"
		) {
			return (input as { command: string }).command;
		}
		return JSON.stringify(input);
	}
	const sanitized = sanitizeToolInput(toolName, input);
	if (
		toolName === "bash" &&
		sanitized &&
		typeof sanitized === "object" &&
		typeof (sanitized as { command?: unknown }).command === "string"
	) {
		return (sanitized as { command: string }).command;
	}
	return JSON.stringify(sanitized);
}

/**
 * Sanitize tool input by redacting secrets and truncating long content.
 * Replaces api keys, tokens, and secrets with [REDACTED] markers.
 * Truncates content fields over 200 characters.
 * When PI_DAMAGE_CONTROL_LOG_RAW=1, returns input unchanged.
 */
function sanitizeToolInput(_toolName: string, input: unknown): unknown {
	if (process.env.PI_DAMAGE_CONTROL_LOG_RAW === "1") {
		return input;
	}
	if (typeof input === "string") {
		return input.replace(SECRET_PATTERN, "$1=[REDACTED]");
	}
	if (!input || typeof input !== "object") {
		return input;
	}
	const record = { ...(input as Record<string, unknown>) };
	if (typeof record.command === "string") {
		record.command = record.command
			.replace(SECRET_PATTERN, "$1=[REDACTED]")
			.replace(/sk-[a-zA-Z0-9]+/g, "sk-[REDACTED]");
	}
	if (typeof record.content === "string" && record.content.length > 200) {
		record.content = `${record.content.slice(0, 200)}… [truncated]`;
	}
	return record;
}

function logViolation(
	pi: ExtensionAPI,
	event: { toolName: string; input: unknown },
	rule: string,
	action: string,
): void {
	pi.appendEntry("damage-control-log", {
		tool: event.toolName,
		input: sanitizeToolInput(event.toolName, event.input),
		rule,
		action,
	});
}

function continueFeedback(toolName: string, violationReason: string, invocation: string): string {
	return [
		`🛡️ Damage-Control: ${toolName} blocked — ${violationReason}`,
		``,
		`Attempted: ${invocation}`,
		``,
		`Don't call ${toolName} directly like this. Decide which case you're in and continue:`,
		``,
		`→ NON-DESTRUCTIVE (e.g. reading .env to verify a key, listing a protected dir, peeking at config):`,
		`   Assume the data is present and correct. Skip the verification step and move on with the task.`,
		`   Example: if you were reading .env to confirm a key exists, just assume it does — the user has`,
		`   configured their environment. If you actually need a value, ask the user for it explicitly.`,
		``,
		`→ DESTRUCTIVE (delete, overwrite, force-push, drop, rm, truncate, sudo, kill, etc.):`,
		`   STOP. Tell the user exactly what you need to ship this task and ask how they want to proceed.`,
		`   Do not invent a workaround that achieves the same destructive effect.`,
		``,
		`Pick the right path above and continue working. Do not retry this exact call.`,
	].join("\n");
}

/**
 * Damage-Control (continue) extension.
 * Intercepts destructive tool calls and replaces them with actionable
 * feedback so the agent can adapt rather than aborting outright.
 * Blocks unsafe operations and guides the agent toward safe alternatives.
 */
export default function (pi: ExtensionAPI) {
	let rules: DamageControlRules = {
		bashToolPatterns: [],
		zeroAccessPaths: [],
		readOnlyPaths: [],
		noDeletePaths: [],
	};

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		const projectRulesPath = join(ctx.cwd, ".pi", "damage-control-rules.yaml");
		const globalRulesPath = join(homedir(), ".pi", "damage-control-rules.yaml");
		const packageRulesPath = powerpackPath(import.meta.url, "config", "damage-control-rules.yaml");
		const rulesPath = existsSync(projectRulesPath)
			? projectRulesPath
			: existsSync(globalRulesPath)
				? globalRulesPath
				: existsSync(packageRulesPath)
					? packageRulesPath
					: null;
		try {
			if (rulesPath) {
				const content = readFileSync(rulesPath, "utf8");
				const loaded = yamlParse(content) as Partial<DamageControlRules>;
				rules = {
					bashToolPatterns: loaded.bashToolPatterns || [],
					zeroAccessPaths: loaded.zeroAccessPaths || [],
					readOnlyPaths: loaded.readOnlyPaths || [],
					noDeletePaths: loaded.noDeletePaths || [],
				};
				const source = rulesPath === projectRulesPath ? "project" : rulesPath === globalRulesPath ? "global" : "package";
				const total = rules.bashToolPatterns.length + rules.zeroAccessPaths.length + rules.readOnlyPaths.length + rules.noDeletePaths.length;
				ctx.ui.notify(`🛡️ Damage-Control (continue): Loaded ${total} rules (${source}). Blocks deliver feedback so the agent can adapt and keep working.`, "info");
			} else {
				ctx.ui.notify("🛡️ Damage-Control (continue): No rules found.", "warning");
			}
		} catch (err) {
			ctx.ui.notify(`🛡️ Damage-Control (continue): Failed to load rules: ${err instanceof Error ? err.message : String(err)}`, "error");
		}

		const total = rules.bashToolPatterns.length + rules.zeroAccessPaths.length + rules.readOnlyPaths.length + rules.noDeletePaths.length;
		ctx.ui.setStatus("damage-control", `🛡️ Damage-Control: ${total} rules`);
	});

	pi.on("tool_call", async (event, ctx) => {
		const { violationReason, shouldAsk } = evaluateToolCall(
			rules,
			event.toolName,
			event.input,
			ctx.cwd,
		);

		if (violationReason) {
			const invocation = redactInvocation(event.toolName, event.input);

			if (shouldAsk) {
				const confirmed = await ctx.ui.confirm(
					"🛡️ Damage-Control Confirmation",
					`Dangerous command detected: ${violationReason}\n\nCommand: ${invocation}\n\nDo you want to proceed?`,
					{ timeout: 30000 },
				);

				if (!confirmed) {
					ctx.ui.setStatus("damage-control", `⚠️ Blocked: ${violationReason.slice(0, 30)}...`);
					logViolation(pi, event, violationReason, "blocked_by_user");
					return { block: true, reason: continueFeedback(event.toolName, `${violationReason} (user denied)`, invocation) };
				} else {
					logViolation(pi, event, violationReason, "confirmed_by_user");
					return { block: false };
				}
			} else {
				ctx.ui.notify(`🛑 Damage-Control: Blocked ${event.toolName} (${violationReason}) — agent will adapt and continue.`, "warning");
				ctx.ui.setStatus("damage-control", `⚠️ Last violation: ${violationReason.slice(0, 30)}...`);
				logViolation(pi, event, violationReason, "blocked");
				return { block: true, reason: continueFeedback(event.toolName, violationReason, invocation) };
			}
		}

		return { block: false };
	});
}

export { sanitizeToolInput };
