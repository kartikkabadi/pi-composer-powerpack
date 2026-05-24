/**
 * themeMap.ts — Per-extension default theme assignments
 *
 * Themes are shipped as package assets. Current Pi releases install those theme
 * files, but extensions do not have a stable public API for switching the active
 * theme at session boot. This module keeps the theme preference map as metadata
 * and applies only the terminal title.
 *
 * Available package theme:
 *   mono-black
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";

// ── Theme assignments ──────────────────────────────────────────────────────
//
// Key   = extension filename without extension (matches extensions/<key>.ts)
// Value = theme name from .pi/themes/<value>.json
//
export const THEME_MAP: Record<string, string> = {
	"agent-chain": "midnight-ocean",
	"agent-team": "dracula",
	"auto-caveman": "gruvbox",
	"coms": "ocean-breeze",
	"cursor-sdk": "mono-black",
	"damage-control-continue": "gruvbox",
	"pi-pi": "rose-pine",
	"subagent-widget": "cyberpunk",
	"superset-hooks": "tokyo-night",
	"tilldone": "everforest",
};

// ── Helpers ───────────────────────────────────────────────────────────────

// ── Theme ──────────────────────────────────────────────────────────────────

/** Theme switching is intentionally a no-op until Pi exposes a stable API. */
export function applyExtensionTheme(_fileUrl: string, _ctx: ExtensionContext): boolean {
	return false;
}
// ── Title ──────────────────────────────────────────────────────────────────

/**
 * Read process.argv to find the first -e / --extension flag value.
 *
 * When Pi is launched as:
 *   pi -e extensions/subagent-widget.ts -e extensions/pure-focus.ts
 *
 * process.argv contains those paths verbatim. Every stacked extension calls
 * this and gets the same answer ("subagent-widget"), so all setTitle calls
 * are idempotent — no shared state or deduplication needed.
 *
 * Returns null if no -e flag is present (e.g. plain `pi` with no extensions).
 */
function primaryExtensionName(): string | null {
	const argv = process.argv;
	for (let i = 0; i < argv.length - 1; i++) {
		if (argv[i] === "-e" || argv[i] === "--extension") {
			return basename(argv[i + 1]).replace(/\.[^.]+$/, "");
		}
	}
	return null;
}

/**
 * Set the terminal title to "π - <first-extension-name>" on session boot.
 * Reads the title from process.argv so all stacked extensions agree on the
 * same value — no coordination or shared state required.
 *
 * Deferred 150 ms to fire after Pi's own startup title-set.
 */
function applyExtensionTitle(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	const name = primaryExtensionName();
	if (!name) return;
	setTimeout(() => ctx.ui.setTitle(`π - ${name}`), 150);
}

// ── Combined default ───────────────────────────────────────────────────────

/**
 * Apply per-extension defaults that are safe in installed packages.
 *
 * Usage:
 *   import { applyExtensionDefaults } from "./themeMap.ts";
 *
 *   pi.on("session_start", async (_event, ctx) => {
 *     applyExtensionDefaults(import.meta.url, ctx);
 *     // ... rest of handler
 *   });
 */
export function applyExtensionDefaults(fileUrl: string, ctx: ExtensionContext): void {
	applyExtensionTheme(fileUrl, ctx);
	applyExtensionTitle(ctx);
}
