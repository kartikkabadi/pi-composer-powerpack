import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

export const TRUNCATE_OUTPUT = 8000;
export const TRUNCATE_EXPANDED = 4000;
export const TRUNCATE_WORK = 50;

export type StatusValue = "idle" | "pending" | "running" | "done" | "error" | "researching";

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
