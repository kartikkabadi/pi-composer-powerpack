import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the root directory of the pi-composer-powerpack package.
 *
 * Uses the provided file URL to locate the package root by going up two
 * directory levels (from extensions/ to package root).
 *
 * @param fileUrl - The import.meta.url of the calling module
 * @returns Absolute path to the package root directory
 *
 * @example
 * ```ts
 * const root = powerpackRoot(import.meta.url);
 * // => /path/to/pi-composer-powerpack
 * ```
 */
export function powerpackRoot(fileUrl: string): string {
	return dirname(dirname(fileURLToPath(fileUrl)));
}

/**
 * Resolve a path relative to the package root.
 *
 * Joins the package root with additional path segments to create a
 * complete file path within the powerpack package.
 *
 * @param fileUrl - The import.meta.url of the calling module
 * @param parts - Additional path segments to join with the root
 * @returns Absolute path to the specified location
 *
 * @example
 * ```ts
 * const agentsPath = powerpackPath(import.meta.url, "agents", "scout.md");
 * // => /path/to/pi-composer-powerpack/agents/scout.md
 * ```
 */
export function powerpackPath(fileUrl: string, ...parts: string[]): string {
	return join(powerpackRoot(fileUrl), ...parts);
}

/**
 * Resolve the agents directory within the powerpack package.
 *
 * Returns the path to the bundled agents directory that contains
 * agent definitions, team configurations, and Pi-Pi expert profiles.
 *
 * @param fileUrl - The import.meta.url of the calling module
 * @returns Absolute path to the agents directory
 */
export function powerpackAgentsDir(fileUrl: string): string {
	return powerpackPath(fileUrl, "agents");
}

/**
 * Resolve the path to the Cursor SDK extension.
 *
 * Returns the path to the cursor-sdk.ts extension that provides
 * the Cursor provider integration for Pi.
 *
 * @param fileUrl - The import.meta.url of the calling module
 * @returns Absolute path to the cursor-sdk.ts extension file
 */
export function powerpackCursorSdkExtension(fileUrl: string): string {
	return powerpackPath(fileUrl, "extensions", "cursor-sdk.ts");
}

/**
 * Resolve the Pi agent home directory.
 *
 * Returns the directory where Pi stores agent data, sessions, and
 * configuration. Can be overridden with the PI_CODING_AGENT_DIR
 * environment variable.
 *
 * @returns Absolute path to the Pi agent home directory
 *
 * @example
 * ```ts
 * const home = piAgentHome();
 * // => /home/user/.pi/agent (or PI_CODING_AGENT_DIR if set)
 * ```
 */
export function piAgentHome(): string {
	return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

/**
 * Resolve the path to the Pi binary.
 *
 * Checks for the configured PI_POWERPACK_PI or PI_BIN environment
 * variables first, then looks for a local installation in ~/.local/bin/pi,
 * and finally falls back to "pi" (expecting it to be in PATH).
 *
 * @returns Absolute path to the Pi binary or "pi" if not found locally
 */
export function resolvePiBinary(): string {
	const configured = process.env.PI_POWERPACK_PI || process.env.PI_BIN;
	if (configured) return configured;

	const localPi = join(homedir(), ".local", "bin", "pi");
	return existsSync(localPi) ? localPi : "pi";
}

/**
 * Resolve the command and arguments needed to spawn Pi.
 *
 * When PI_POWERPACK_PI points at a .mjs/.js script, spawns via node.
 * Otherwise, uses the resolved Pi binary directly.
 *
 * @returns Object with command and prefixArgs for spawning Pi
 *
 * @example
 * ```ts
 * const { command, prefixArgs } = resolvePiSpawn();
 * spawn(command, [...prefixArgs, ...otherArgs]);
 * ```
 */
export function resolvePiSpawn(): { command: string; prefixArgs: string[] } {
	const configured = process.env.PI_POWERPACK_PI || process.env.PI_BIN;
	if (configured && (configured.endsWith(".mjs") || configured.endsWith(".js"))) {
		return { command: process.execPath, prefixArgs: [configured] };
	}
	return { command: resolvePiBinary(), prefixArgs: [] };
}
