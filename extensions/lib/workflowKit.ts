import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Maximum characters for truncated output displays */
export const TRUNCATE_OUTPUT = 8000;

/** Maximum characters for expanded output displays */
export const TRUNCATE_EXPANDED = 4000;

/** Maximum characters for work text displays */
export const TRUNCATE_WORK = 50;

/** Status values for agent/task states */
export type StatusValue = "idle" | "pending" | "running" | "done" | "error" | "researching";

/**
 * Get the theme color for a status value.
 *
 * @param s - The status value to get color for
 * @returns The ThemeColor corresponding to the status
 */
export function statusColor(s: StatusValue): ThemeColor {
	switch (s) {
		case "idle":
		case "pending":
			return "dim";
		case "running":
		case "researching":
			return "accent";
		case "done":
			return "success";
		case "error":
			return "error";
	}
}

/**
 * Get the icon character for a status value.
 *
 * @param s - The status value to get icon for
 * @returns The icon character representing the status
 */
export function statusIcon(s: StatusValue): string {
	switch (s) {
		case "idle":
		case "pending":
			return "○";
		case "running":
			return "●";
		case "researching":
			return "◉";
		case "done":
			return "✓";
		case "error":
			return "✗";
	}
}

/**
 * Truncate a string to a maximum length, adding "..." if truncated.
 *
 * @param s - The string to truncate
 * @param max - Maximum length before truncation
 * @returns Truncated string with "..." suffix if needed
 */
export function truncateText(s: string, max: number): string {
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/**
 * Truncate output text to a limit, adding a truncation notice.
 *
 * @param output - The output text to truncate
 * @param limit - Maximum character limit (default: TRUNCATE_OUTPUT)
 * @returns Truncated output with "[truncated]" notice if needed
 */
export function truncateOutput(output: string, limit = TRUNCATE_OUTPUT): string {
	return output.length > limit
		? output.slice(0, limit) + "\n\n... [truncated]"
		: output;
}

/**
 * Extract the last non-empty line from text.
 *
 * @param text - The text to extract from
 * @returns The last non-empty line, or empty string if none found
 */
export function lastNonEmptyLine(text: string): string {
	return text.split("\n").filter((l) => l.trim()).pop() || "";
}

// ── Status Card ─────────────────────────────────────────────────────────────

/** A single line in a status card with its visible length */
export interface CardLine {
	text: string;
	visibleLen: number;
}

/** Options for rendering a status card */
export interface StatusCardOptions {
	name: string;
	status: StatusValue;
	elapsed: number;
	workText: string;
	theme: Theme;
	colWidth: number;
	extraLines?: CardLine[];
	borderColors?: { bg: string; br: string };
}

const FG_RESET = "\x1b[39m";
const BG_RESET = "\x1b[49m";

/**
 * Render a status card for an agent or task.
 *
 * Creates a formatted card with name, status, elapsed time, and work text.
 * Used in workflow dashboards to display agent states.
 *
 * @param opts - Options for rendering the status card
 * @returns Array of formatted strings representing the card
 */
export function renderStatusCard(opts: StatusCardOptions): string[] {
	const { name, status, elapsed, workText, theme, colWidth, extraLines, borderColors } = opts;
	const w = colWidth - 2;

	const nameStr = theme.fg("accent", theme.bold(truncateText(name, w)));
	const nameVisible = Math.min(name.length, w);

	const sIcon = statusIcon(status);
	const sColor = statusColor(status);
	const statusStr = `${sIcon} ${status}`;
	const timeStr = status !== "idle" && status !== "pending" ? ` ${Math.round(elapsed / 1000)}s` : "";
	const statusLine = theme.fg(sColor, statusStr + timeStr);
	const statusVisible = statusStr.length + timeStr.length;

	const workTrimmed = truncate(workText, w - 2);
	const workLine = theme.fg("dim", `  ${workTrimmed}`);
	const workVisible = workTrimmed.length + 2;

	// Pad lines to equal width
	const pad = (s: string, vis: number) => s + " ".repeat(Math.max(0, w - vis));

	const lines = [
		pad(nameStr, nameVisible),
		pad(statusLine, statusVisible),
		pad(workLine, workVisible),
	];

	if (extraLines) {
		for (const line of extraLines) {
			lines.push(pad(line.text, line.visibleLen));
		}
	}

	return lines;
}

/**
 * Install a context footer in the extension.
 *
 * Adds a persistent footer to the TUI showing context information
 * like active agents, tasks, or other workflow state.
 *
 * @param pi - The extension API
 * @param ctx - The extension context
 * @param getFooter - Function that returns the footer content
 */
export function installContextFooter(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	getFooter: () => string,
): void {
	ctx.ui.setFooter(getFooter);
}

/**
 * Render a tool call line for display.
 *
 * Formats a tool name and arguments for display in the workflow UI.
 *
 * @param toolName - Name of the tool being called
 * @param args - Tool arguments (will be JSON serialized)
 * @param theme - Theme for styling
 * @returns Formatted string for the tool call
 */
export function renderToolCallLine(
	toolName: string,
	args: unknown,
	theme: Theme,
): string {
	const argsStr = typeof args === "string" ? args : JSON.stringify(args);
	const truncated = truncateText(argsStr, 40);
	return theme.fg("dim", `${toolName} ${truncated}`);
}

/**
 * Clear session files from a directory.
 *
 * Removes all .jsonl files from the specified directory.
 * Used for cleaning up old session data.
 *
 * @param dir - Directory containing session files
 */
export function clearSessionFiles(dir: string): void {
	if (!existsSync(dir)) return;
	try {
		const files = readdirSync(dir);
		for (const file of files) {
			if (file.endsWith(".jsonl")) {
				unlinkSync(join(dir, file));
			}
		}
	} catch {
		// best-effort cleanup
	}
}
}

export function statusIcon(s: StatusValue): string {
	switch (s) {
		case "idle":
		case "pending":
			return "○";
		case "running":
			return "●";
		case "researching":
			return "◉";
		case "done":
			return "✓";
		case "error":
			return "✗";
	}
}

export function truncateText(s: string, max: number): string {
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function truncateOutput(output: string, limit = TRUNCATE_OUTPUT): string {
	return output.length > limit
		? output.slice(0, limit) + "\n\n... [truncated]"
		: output;
}

export function lastNonEmptyLine(text: string): string {
	return text.split("\n").filter((l) => l.trim()).pop() || "";
}

// ── Status Card ─────────────────────────────────────────────────────────────

export interface CardLine {
	text: string;
	visibleLen: number;
}

export interface StatusCardOptions {
	name: string;
	status: StatusValue;
	elapsed: number;
	workText: string;
	theme: Theme;
	colWidth: number;
	extraLines?: CardLine[];
	borderColors?: { bg: string; br: string };
}

const FG_RESET = "\x1b[39m";
const BG_RESET = "\x1b[49m";

export function renderStatusCard(opts: StatusCardOptions): string[] {
	const { name, status, elapsed, workText, theme, colWidth, extraLines, borderColors } = opts;
	const w = colWidth - 2;

	const nameStr = theme.fg("accent", theme.bold(truncateText(name, w)));
	const nameVisible = Math.min(name.length, w);

	const sIcon = statusIcon(status);
	const sColor = statusColor(status);
	const statusStr = `${sIcon} ${status}`;
	const timeStr = status !== "idle" && status !== "pending" ? ` ${Math.round(elapsed / 1000)}s` : "";
	const statusLine = theme.fg(sColor, statusStr + timeStr);
	const statusVisible = statusStr.length + timeStr.length;

	const workTrimmed = truncateText(workText, Math.min(TRUNCATE_WORK, w - 1));
	const workLine = workTrimmed ? theme.fg("muted", workTrimmed) : theme.fg("dim", "—");
	const workVisible = workTrimmed ? workTrimmed.length : 1;

	const bg = borderColors?.bg ?? "";
	const br = borderColors?.br ?? "";
	const bgr = bg ? BG_RESET : "";
	const fgr = br ? FG_RESET : "";

	const bord = br ? (s: string) => bg + br + s + bgr + fgr : (s: string) => theme.fg("dim", s);

	const top = "┌" + "─".repeat(w) + "┐";
	const bot = "└" + "─".repeat(w) + "┘";
	const border = (content: string, visLen: number) => {
		const pad = " ".repeat(Math.max(0, w - visLen));
		return bord("│") + (bg || "") + content + (bg || "") + pad + bgr + bord("│");
	};

	const lines: string[] = [
		bord(top),
		border(" " + nameStr, 1 + nameVisible),
		border(" " + statusLine, 1 + statusVisible),
	];

	if (extraLines) {
		for (const el of extraLines) {
			lines.push(border(" " + el.text, 1 + el.visibleLen));
		}
	}

	lines.push(border(" " + workLine, 1 + workVisible));
	lines.push(bord(bot));

	return lines;
}

// ── Context Footer ──────────────────────────────────────────────────────────

export function installContextFooter(
	ctx: ExtensionContext,
	label: string,
): void {
	ctx.ui.setFooter((_tui, theme, _footerData) => ({
		dispose: () => {},
		invalidate() {},
		render(width: number): string[] {
			const model = (ctx as any).model?.id || "no-model";
			const usage = (ctx as any).getContextUsage?.();
			const pct = usage ? usage.percent : 0;
			const filled = Math.round(pct / 10);
			const bar = "#".repeat(filled) + "-".repeat(10 - filled);

			const left = theme.fg("dim", ` ${model}`) +
				theme.fg("muted", " · ") +
				theme.fg("accent", label);
			const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
			const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

			return [truncateToWidth(left + pad + right, width)];
		},
	}));
}

// ── Mode Toggle ─────────────────────────────────────────────────────────────

export interface ModeToggle {
	enable(): void;
	disable(): void;
	readonly active: boolean;
}

export function createModeToggle(
	pi: ExtensionAPI,
	opts: {
		statusKey: string;
		activeToolNames: string[];
		allToolNames: () => string[];
		onEnable?: (ctx: ExtensionContext) => void;
		onDisable?: (ctx: ExtensionContext) => void;
	},
): ModeToggle {
	let active = false;
	return {
		get active() { return active; },
		enable() { active = true; },
		disable() {
			active = false;
			const all = opts.allToolNames();
			if (all.length > 0) pi.setActiveTools(all);
		},
	};
}

// ── Tool Call/Result Rendering ──────────────────────────────────────────────

export function renderToolCallLine(
	theme: Theme,
	toolTitle: string,
	label: string,
	preview: string,
): Text {
	return new Text(
		theme.fg("toolTitle", theme.bold(`${toolTitle} `)) +
		theme.fg("accent", label) +
		theme.fg("dim", " — ") +
		theme.fg("muted", preview),
		0, 0,
	);
}

export function renderToolResultLine(
	theme: Theme,
	status: "done" | "error",
	label: string,
	elapsedMs: number,
): Text {
	const icon = status === "done" ? "✓" : "✗";
	const color = status === "done" ? "success" : "error";
	const elapsed = Math.round(elapsedMs / 1000);
	return new Text(
		theme.fg(color, `${icon} ${label}`) + theme.fg("dim", ` ${elapsed}s`),
		0, 0,
	);
}

// ── Session Cleanup ─────────────────────────────────────────────────────────

export function clearSessionFiles(sessionDir: string, prefix: string): void {
	if (!existsSync(sessionDir)) return;
	for (const f of readdirSync(sessionDir)) {
		if (f.startsWith(prefix) && f.endsWith(".json")) {
			try { unlinkSync(join(sessionDir, f)); } catch { /* best-effort */ }
		}
	}
}
