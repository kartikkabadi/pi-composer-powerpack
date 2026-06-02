import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { abbreviateModel, hexFg } from "./protocol.ts";
import {
	readAllRegistryEntries,
	readAllRegistryEntriesAcrossProjects,
} from "./registry.ts";
import type { ComsIdentity, PeerCard } from "./types.ts";

/** Dependency bag for the coms pool widget renderer. */
export interface PoolWidgetDeps {
	getIdentity: () => ComsIdentity | null;
	getDisplayProject: () => string | null;
	getIncludeExplicit: () => boolean;
	peerCards: Map<string, PeerCard>;
}

/**
 * Create a pool widget renderer.
 *
 * Reads registry entries and peer cards to produce terminal lines
 * displaying the coms peer pool status.
 *
 * @param deps - Dependencies for the renderer
 * @returns A function that renders the pool widget given width and theme
 */
export function createRenderPool(deps: PoolWidgetDeps): (width: number, theme: Theme) => string[] {
	return function renderPool(width: number, theme: Theme): string[] {
		const identity = deps.getIdentity();
		const projectFilter = deps.getDisplayProject() ?? identity?.project ?? "default";
		const includeExplicit = deps.getIncludeExplicit();
		const registryEntries = projectFilter === "*"
			? readAllRegistryEntriesAcrossProjects()
			: readAllRegistryEntries(projectFilter);

		interface Row {
			name: string;
			model: string;
			color: string;
			purpose: string;
			pct: number | null;
			pending: boolean;
			stale: boolean;
		}
		const rows: Row[] = [];
		const seenSessions = new Set<string>();

		for (const [sid, card] of deps.peerCards.entries()) {
			if (identity && sid === identity.session_id) continue;
			seenSessions.add(sid);
			rows.push({
				name: card.name,
				model: card.model,
				color: card.color,
				purpose: card.purpose,
				pct: card.context_used_pct,
				pending: false,
				stale: (card.staleCount ?? 0) >= 3,
			});
		}

		const seenNames = new Set(rows.map((r) => r.name));
		for (const entry of registryEntries) {
			if (identity && entry.session_id === identity.session_id) continue;
			if (!includeExplicit && entry.explicit) continue;
			if (seenSessions.has(entry.session_id)) continue;
			if (seenNames.has(entry.name)) continue;
			rows.push({
				name: entry.name,
				model: entry.model,
				color: entry.color,
				purpose: entry.purpose,
				pct: null,
				pending: true,
				stale: false,
			});
		}

		const safeWidth = Math.max(0, width);
		let topBorder: string;
		let bottomBorder: string;
		if (safeWidth < 12) {
			topBorder = theme.fg("dim", "━".repeat(safeWidth));
			bottomBorder = theme.fg("dim", "━".repeat(safeWidth));
		} else {
			const left = theme.fg("dim", "┏━") + theme.fg("border", " coms ");
			const right = theme.fg("dim", "━".repeat(Math.max(0, safeWidth - left.length + theme.fg("dim", "").length)));
			topBorder = left + right;
			bottomBorder = theme.fg("dim", "┗" + "━".repeat(safeWidth - 1));
		}

		const lines: string[] = [topBorder];
		if (rows.length === 0) {
			lines.push(theme.fg("dim", " (no peers)"));
		} else {
			for (const row of rows) {
				const status = row.stale ? theme.fg("error", "✗") : row.pending ? theme.fg("dim", "○") : theme.fg("success", "●");
				const nameStr = hexFg(row.color, row.name);
				const modelStr = theme.fg("dim", ` ${abbreviateModel(row.model)}`);
				const pctStr = row.pct !== null ? theme.fg("dim", ` ${Math.round(row.pct)}%`) : "";
				const line = `${status} ${nameStr}${modelStr}${pctStr}`;
				lines.push(truncateToWidth(line, safeWidth));
			}
		}
		lines.push(bottomBorder);
		return lines;
	};
}

/**
 * Install the pool widget in the extension context.
 *
 * @param ctx - The extension context
 * @param renderPool - The pool renderer function
 */
export function installPoolWidget(ctx: ExtensionContext, renderPool: (width: number, theme: Theme) => string[]): void {
	ctx.ui.setWidget("coms-pool", (_tui, theme) => ({
		render(width: number): string[] {
			return renderPool(width, theme);
		},
		invalidate() {},
	}));
}const leftFill = theme.fg("dim", "━");
			const nameLen = identity ? identity.name.length : 0;
			const rightTagVisLen = identity ? nameLen + 4 : 0;
			const remaining = safeWidth - 9 - rightTagVisLen - 1;
			if (identity && remaining >= 1) {
				const rightTag =
					theme.fg("dim", " ") +
					hexFg(identity.color, identity.name) +
					theme.fg("dim", " ━");
				const middle = theme.fg("dim", "━".repeat(remaining));
				const right = theme.fg("dim", "┓");
				topBorder = left + leftFill + middle + rightTag + right;
			} else {
				const fallbackRemaining = Math.max(0, safeWidth - 2 - 6 - 1);
				const right = theme.fg("dim", "━".repeat(fallbackRemaining) + "┓");
				topBorder = left + right;
			}
			bottomBorder = theme.fg("dim", "┗" + "━".repeat(safeWidth - 2) + "┛");
		}

		if (rows.length === 0) {
			const emptyMsg = theme.fg("muted", "no peers connected");
			return [
				topBorder,
				truncateToWidth(theme.fg("dim", " ") + emptyMsg, width),
				bottomBorder,
			];
		}

		rows.sort((a, b) => a.name.localeCompare(b.name));

		const out: string[] = [topBorder];

		for (const r of rows) {
			const pctNum = r.pct ?? 0;
			const filled = Math.max(0, Math.min(15, Math.round((pctNum / 100) * 15)));
			const empty = 15 - filled;
			const pctLabel = r.pct == null ? "--%" : `${r.pct}%`;

			if (r.stale) {
				const dimRow = `✗ ${r.name.padEnd(12)} ${abbreviateModel(r.model).padEnd(14)} [${"-".repeat(15)}] ${pctLabel.padStart(4)}  —  ${r.purpose || ""}`;
				out.push(truncateToWidth(" " + theme.fg("dim", dimRow), width));
				continue;
			}

			const swatch = r.pending ? theme.fg("dim", "●") : hexFg(r.color, "●");
			const namePart = theme.fg("accent", r.name.padEnd(12));
			const modelPart = theme.fg("dim", abbreviateModel(r.model).padEnd(14));
			const barFill = r.pending
				? theme.fg("dim", "-".repeat(15))
				: hexFg(r.color, "#".repeat(filled)) + theme.fg("dim", "-".repeat(empty));
			const bar = theme.fg("warning", "[") + barFill + theme.fg("warning", "]");
			const pctPart = " " + theme.fg("accent", pctLabel.padStart(4));
			const sep = theme.fg("dim", "  —  ");
			const purposePart = theme.fg("muted", r.purpose || "");

			const line = " " + swatch + " " + namePart + " " + modelPart + " " + bar + pctPart + sep + purposePart;
			out.push(truncateToWidth(line, width));
		}

		out.push(bottomBorder);
		return out;
	};
}

/** Register the coms-pool widget in the Pi terminal UI. No-op if the UI is not available. */
export function installPoolWidget(
	ctx: ExtensionContext,
	renderPool: (width: number, theme: Theme) => string[],
): void {
	if (!ctx.hasUI) return;
	try {
		ctx.ui.setWidget("coms-pool", (_tui, theme) => ({
			invalidate() {},
			render(width: number): string[] {
				return renderPool(width, theme);
			},
		}), { placement: "belowEditor" });
	} catch {
		// non-fatal
	}
}
