/**
 * childAgentSession — Single spawn seam for child Pi agent subprocesses.
 *
 * Unified entry point that combines subprocess config (model, flags, tool
 * selection, damage-control loading) with the NDJSON process runner and
 * lifecycle handlers. Callers should only need this module.
 */

import type { ChildProcess } from "node:child_process";
import {
	spawnPiJsonProcess,
	type PiJsonHandlers,
	type PiJsonRunResult,
} from "./piJsonSubprocess.ts";
import {
	piAgentHome,
	powerpackCursorSdkExtension,
	powerpackPath,
} from "../powerpackPaths.ts";

export { piAgentHome };

// ── Config ──────────────────────────────────────────────────────────────────

/**
 * Get the Cursor model to use for child agents.
 *
 * Returns the model from PI_SUBAGENT_MODEL environment variable,
 * or defaults to "cursor/composer-2.5".
 *
 * @returns The Cursor model identifier
 */
export function getCursorModel(): string {
	return process.env.PI_SUBAGENT_MODEL || "cursor/composer-2.5";
}

/**
 * Get Cursor fast flags for child agents.
 *
 * Returns ["--cursor-fast"] unless PI_SUBAGENT_CURSOR_FAST is set to "0".
 *
 * @returns Array of Cursor fast flags
 */
export function getCursorFastFlags(): string[] {
	return process.env.PI_SUBAGENT_CURSOR_FAST === "0" ? [] : ["--cursor-fast"];
}

/**
 * Get the path to the Cursor SDK extension for child agents.
 *
 * Returns the path from PI_CURSOR_SDK_EXTENSION environment variable,
 * or resolves it from the powerpack package.
 *
 * @param callerUrl - The import.meta.url of the calling module
 * @returns Absolute path to the cursor-sdk.ts extension
 */
export function getCursorSdkExtensionPath(callerUrl: string): string {
	return process.env.PI_CURSOR_SDK_EXTENSION || powerpackCursorSdkExtension(callerUrl);
}

/**
 * Get the path to the damage control extension for child agents.
 *
 * Returns the path from PI_DAMAGE_CONTROL_EXTENSION environment variable,
 * or resolves it from the powerpack package.
 *
 * @param callerUrl - The import.meta.url of the calling module
 * @returns Absolute path to the damage-control-continue.ts extension
 */
export function getDamageControlExtensionPath(callerUrl: string): string {
	return (
		process.env.PI_DAMAGE_CONTROL_EXTENSION ||
		powerpackPath(callerUrl, "extensions", "damage-control-continue.ts")
	);
}

/**
 * Check if child agents should load damage control.
 *
 * Returns true unless PI_SUBAGENT_DAMAGE_CONTROL is set to "0".
 *
 * @returns true if damage control should be loaded
 */
export function shouldLoadChildDamageControl(): boolean {
	return process.env.PI_SUBAGENT_DAMAGE_CONTROL !== "0";
}

// ── Options ─────────────────────────────────────────────────────────────────

/** Options for spawning a child Pi agent */
export type ChildAgentOptions = {
	task: string;
	tools: string;
	systemPrompt?: string;
	sessionFile?: string;
	continueSession?: boolean;
	ephemeral?: boolean;
	includeDamageControl?: boolean;
};

/**
 * Build the command-line arguments for a child Pi agent.
 *
 * Constructs the argv array for spawning a Pi subprocess with the
 * appropriate flags, model, tools, and extensions.
 *
 * @param callerUrl - The import.meta.url of the calling module
 * @param opts - Options for the child agent
 * @returns Array of command-line arguments
 */
export function buildChildPiArgv(callerUrl: string, opts: ChildAgentOptions): string[] {
	const includeDc = opts.includeDamageControl ?? shouldLoadChildDamageControl();
	const args = [
		"--mode", "json",
		"-p",
		"--no-extensions",
		"--extension", getCursorSdkExtensionPath(callerUrl),
	];

	if (includeDc) {
		args.push("--extension", getDamageControlExtensionPath(callerUrl));
	}

	args.push(...getCursorFastFlags());
	args.push("--model", getCursorModel());
	args.push("--tools", opts.tools);
	args.push("--thinking", "off");

	if (opts.systemPrompt) {
		args.push("--append-system-prompt", opts.systemPrompt);
	}

	if (opts.ephemeral) {
		args.push("--no-session");
	} else if (opts.sessionFile) {
		args.push("--session", opts.sessionFile);
		if (opts.continueSession) {
			args.push("-c");
		}
	}

	args.push(opts.task);
	return args;
}

// ── Spawn ───────────────────────────────────────────────────────────────────

/** Result from spawning a child agent */
export type ChildAgentResult = PiJsonRunResult;

/** Handlers for child agent lifecycle events */
export type ChildAgentHandlers = PiJsonHandlers;

/**
 * Spawn a child Pi agent subprocess.
 *
 * Creates a new Pi process with the specified options and runs it to
 * completion, collecting output and handling lifecycle events.
 *
 * @param callerUrl - The import.meta.url of the calling module
 * @param opts - Options for the child agent
 * @param handlers - Optional lifecycle event handlers
 * @returns Promise resolving to the agent's output and exit status
 */
export async function spawnChildAgent(
	callerUrl: string,
	opts: ChildAgentOptions,
	handlers: ChildAgentHandlers = {},
): Promise<ChildAgentResult> {
	return spawnPiJsonProcess(callerUrl, opts, handlers);
}

export function getCursorFastFlags(): string[] {
	return process.env.PI_SUBAGENT_CURSOR_FAST === "0" ? [] : ["--cursor-fast"];
}

export function getCursorSdkExtensionPath(callerUrl: string): string {
	return process.env.PI_CURSOR_SDK_EXTENSION || powerpackCursorSdkExtension(callerUrl);
}

export function getDamageControlExtensionPath(callerUrl: string): string {
	return (
		process.env.PI_DAMAGE_CONTROL_EXTENSION ||
		powerpackPath(callerUrl, "extensions", "damage-control-continue.ts")
	);
}

export function shouldLoadChildDamageControl(): boolean {
	return process.env.PI_SUBAGENT_DAMAGE_CONTROL !== "0";
}

// ── Options ─────────────────────────────────────────────────────────────────

export type ChildAgentOptions = {
	task: string;
	tools: string;
	systemPrompt?: string;
	sessionFile?: string;
	continueSession?: boolean;
	ephemeral?: boolean;
	includeDamageControl?: boolean;
};

export function buildChildPiArgv(callerUrl: string, opts: ChildAgentOptions): string[] {
	const includeDc = opts.includeDamageControl ?? shouldLoadChildDamageControl();
	const args = [
		"--mode", "json",
		"-p",
		"--no-extensions",
		"--extension", getCursorSdkExtensionPath(callerUrl),
	];

	if (includeDc) {
		args.push("--extension", getDamageControlExtensionPath(callerUrl));
	}

	args.push(...getCursorFastFlags());
	args.push("--model", getCursorModel());
	args.push("--tools", opts.tools);
	args.push("--thinking", "off");

	if (opts.systemPrompt) {
		args.push("--append-system-prompt", opts.systemPrompt);
	}

	if (opts.ephemeral) {
		args.push("--no-session");
	} else if (opts.sessionFile) {
		args.push("--session", opts.sessionFile);
		if (opts.continueSession) {
			args.push("-c");
		}
	}

	args.push(opts.task);
	return args;
}

// ── Handlers ────────────────────────────────────────────────────────────────

export type ChildAgentHandlers = PiJsonHandlers;

export type ChildAgentResult = PiJsonRunResult & {
	proc?: ChildProcess;
};

// ── Spawn ───────────────────────────────────────────────────────────────────

/**
 * Spawn a child Pi agent subprocess with NDJSON event streaming.
 *
 * This is the single public API for all callers (agent-chain, agent-team,
 * pi-pi, subagent-widget). It combines config resolution, process spawning,
 * and lifecycle event routing.
 */
export function spawnChildAgent(
	callerUrl: string,
	opts: ChildAgentOptions,
	handlers: ChildAgentHandlers = {},
): Promise<ChildAgentResult> {
	let proc: ChildProcess | undefined;
	return spawnPiJsonProcess(callerUrl, opts, {
		...handlers,
		onSpawn: (child) => {
			proc = child;
			handlers.onSpawn?.(child);
		},
	}).then((result) => ({ ...result, proc }));
}
