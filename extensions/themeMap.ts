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

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";

export type { Theme };

/**
 * Mapping of extension filenames to their desired theme names.
 *
 * Keys are extension filenames without the .ts extension (matching
 * extensions/<key>.ts). Values are theme names from .pi/themes/<value>.json.
 *
 * Only "mono-black" ships in this package (themes/mono-black.json).
 * Other entries are aspirational — they resolve only if the user has the
 * corresponding theme installed in ~/.pi/agent/themes/ or .pi/themes/.
 * Theme switching is a no-op until Pi exposes a stable API, so these are
 * metadata only (used for future theme-switch support).
 */
export const THEME_MAP: Record<string, string> = {
	"cursor-sdk": "mono-black",
	"agent-chain": "midnight-ocean",
	"agent-team": "dracula",
	"pi-pi": "rose-pine",
	"coms": "ocean-breeze",
	"subagent-widget": "cyberpunk",
	"damage-control-continue": "gruvbox",
	"auto-caveman": "gruvbox",
	"superset-hooks": "tokyo-night",
	"tilldone": "everforest",
};

/**
 * Apply the default theme for an extension.
 *
 * This function is intentionally a no-op until Pi exposes a stable API
 * for theme switching. Currently returns false to indicate no theme
 * was applied.
 *
 * @param _fileUrl - The import.meta.url of the calling extension (unused)
 * @param _ctx - The extension context (unused)
 * @returns Always returns false (no-op)
 */
export function applyExtensionTheme(_fileUrl: string, _ctx: ExtensionContext): boolean {
	return false;
}

/**
 * Apply extension defaults for a given extension.
 *
 * Sets the terminal title based on the extension name and applies any
 * default configuration. This function is called during session_start
 * to initialize extension-specific settings.
 *
 * @param fileUrl - The import.meta.url of the calling extension
 * @param ctx - The extension context for UI updates
 * @returns Always returns true to indicate defaults were applied
 */
export function applyExtensionDefaults(fileUrl: string, ctx: ExtensionContext): boolean {
	const name = basename(fileUrl).replace(/\.[^.]+$/, "");
	if (name) {
		ctx.ui.setTitle(`pi-${name}`);
	}
	return true;
}

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
