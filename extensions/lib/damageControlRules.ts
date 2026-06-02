import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

/** A bash command pattern that should be blocked or require confirmation */
export type BashRule = {
	pattern: string;
	reason: string;
	ask?: boolean;
};

/** Rules for controlling tool execution safety */
export type DamageControlRules = {
	bashToolPatterns: BashRule[];
	zeroAccessPaths: string[];
	readOnlyPaths: string[];
	noDeletePaths: string[];
};

/** Result of evaluating a tool call against damage control rules */
export type ToolCallEvaluation = {
	violationReason: string | null;
	shouldAsk: boolean;
};

/**
 * Resolve a path relative to the working directory.
 *
 * Handles ~ expansion for home directory paths.
 *
 * @param p - The path to resolve
 * @param cwd - The working directory
 * @returns Absolute resolved path
 */
function resolvePath(p: string, cwd: string): string {
	let target = p;
	if (target.startsWith("~")) {
		target = join(homedir(), target.slice(1));
	}
	return resolve(cwd, target);
}

/**
 * Check if a path matches a pattern.
 *
 * Supports glob-like patterns with * wildcards and directory patterns.
 *
 * @param targetPath - The path to check
 * @param pattern - The pattern to match against
 * @param cwd - The working directory
 * @returns true if the path matches the pattern
 */
function isPathMatch(targetPath: string, pattern: string, cwd: string): boolean {
	const resolvedPattern = pattern.startsWith("~")
		? join(homedir(), pattern.slice(1))
		: pattern;

	if (resolvedPattern.endsWith("/")) {
		const absolutePattern = isAbsolute(resolvedPattern)
			? resolvedPattern
			: resolve(cwd, resolvedPattern);
		return targetPath.startsWith(absolutePattern);
	}

	const regexPattern = resolvedPattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");

	const regex = new RegExp(
		`^${regexPattern}$|^${regexPattern}/|/${regexPattern}$|/${regexPattern}/`,
	);

	const relativePath = relative(cwd, targetPath);

	return (
		regex.test(targetPath) ||
		regex.test(relativePath) ||
		targetPath.includes(resolvedPattern) ||
		relativePath.includes(resolvedPattern)
	);
}

/**
 * Convert input to a record for property access.
 *
 * @param input - The input to convert
 * @returns Record with string keys
 */
function inputRecord(input: unknown): Record<string, unknown> {
	if (input && typeof input === "object") {
		return input as Record<string, unknown>;
	}
	return {};
}

/**
 * Evaluate a tool call against damage control rules.
 *
 * Checks bash patterns, zero-access paths, read-only paths, and
 * no-delete paths to determine if the tool call should be blocked
 * or require user confirmation.
 *
 * @param rules - The damage control rules to apply
 * @param toolName - Name of the tool being called
 * @param input - Tool input parameters
 * @param cwd - Current working directory
 * @returns Evaluation result with violation reason and ask flag
 */
export function evaluateToolCall(
	rules: DamageControlRules,
	toolName: string,
	input: unknown,
	cwd: string,
): ToolCallEvaluation {
	let violationReason: string | null = null;
	let shouldAsk = false;

	const record = inputRecord(input);

	const checkPaths = (pathsToCheck: string[]) => {
		for (const p of pathsToCheck) {
			const resolved = resolvePath(p, cwd);
			for (const zap of rules.zeroAccessPaths) {
				if (isPathMatch(resolved, zap, cwd)) {
					return `Access to zero-access path restricted: ${zap}`;
				}
			}
		}
		return null;
	};

	const inputPaths: string[] = [];
	if (toolName === "read" || toolName === "write" || toolName === "edit") {
		if (typeof record.path === "string") inputPaths.push(record.path);
	} else if (toolName === "grep" || toolName === "find" || toolName === "ls") {
		inputPaths.push(typeof record.path === "string" ? record.path : ".");
	}

	if (toolName === "grep" || toolName === "find" || toolName === "ls") {
		const zapCheck = checkPaths(inputPaths);
		if (zapCheck) {
			violationReason = zapCheck;
			return { violationReason, shouldAsk: false };
		}
	}

	if (toolName === "bash" && typeof record.command === "string") {
		const cmd = record.command;
		for (const rule of rules.bashToolPatterns) {
			const regex = new RegExp(rule.pattern, "i");
			if (regex.test(cmd)) {
				if (rule.ask) {
					shouldAsk = true;
					violationReason = rule.reason;
				} else {
					violationReason = rule.reason;
					return { violationReason, shouldAsk: false };
				}
			}
		}
	}

	if (!violationReason) {
		for (const p of inputPaths) {
			const resolved = resolvePath(p, cwd);

			for (const rop of rules.readOnlyPaths) {
				if (isPathMatch(resolved, rop, cwd)) {
					if (toolName === "write" || toolName === "edit") {
						violationReason = `Write access to read-only path restricted: ${rop}`;
						return { violationReason, shouldAsk: false };
					}
				}
			}

			for (const ndp of rules.noDeletePaths) {
				if (isPathMatch(resolved, ndp, cwd)) {
					if (toolName === "bash") {
						const cmd = typeof record.command === "string" ? record.command : "";
						if (/\brm\b/.test(cmd) || /\brmdir\b/.test(cmd) || /\bdel\b/.test(cmd)) {
							violationReason = `Delete access to protected path restricted: ${ndp}`;
							return { violationReason, shouldAsk: false };
						}
					}
				}
			}
		}
	}

	return { violationReason, shouldAsk };
}
	return resolve(cwd, target);
}

function isPathMatch(targetPath: string, pattern: string, cwd: string): boolean {
	const resolvedPattern = pattern.startsWith("~")
		? join(homedir(), pattern.slice(1))
		: pattern;

	if (resolvedPattern.endsWith("/")) {
		const absolutePattern = isAbsolute(resolvedPattern)
			? resolvedPattern
			: resolve(cwd, resolvedPattern);
		return targetPath.startsWith(absolutePattern);
	}

	const regexPattern = resolvedPattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");

	const regex = new RegExp(
		`^${regexPattern}$|^${regexPattern}/|/${regexPattern}$|/${regexPattern}/`,
	);

	const relativePath = relative(cwd, targetPath);

	return (
		regex.test(targetPath) ||
		regex.test(relativePath) ||
		targetPath.includes(resolvedPattern) ||
		relativePath.includes(resolvedPattern)
	);
}

function inputRecord(input: unknown): Record<string, unknown> {
	if (input && typeof input === "object") {
		return input as Record<string, unknown>;
	}
	return {};
}

export function evaluateToolCall(
	rules: DamageControlRules,
	toolName: string,
	input: unknown,
	cwd: string,
): ToolCallEvaluation {
	let violationReason: string | null = null;
	let shouldAsk = false;

	const record = inputRecord(input);

	const checkPaths = (pathsToCheck: string[]) => {
		for (const p of pathsToCheck) {
			const resolved = resolvePath(p, cwd);
			for (const zap of rules.zeroAccessPaths) {
				if (isPathMatch(resolved, zap, cwd)) {
					return `Access to zero-access path restricted: ${zap}`;
				}
			}
		}
		return null;
	};

	const inputPaths: string[] = [];
	if (toolName === "read" || toolName === "write" || toolName === "edit") {
		if (typeof record.path === "string") inputPaths.push(record.path);
	} else if (toolName === "grep" || toolName === "find" || toolName === "ls") {
		inputPaths.push(typeof record.path === "string" ? record.path : ".");
	}

	if (toolName === "grep" && typeof record.glob === "string") {
		for (const zap of rules.zeroAccessPaths) {
			if (record.glob.includes(zap) || isPathMatch(record.glob, zap, cwd)) {
				violationReason = `Glob matches zero-access path: ${zap}`;
				break;
			}
		}
	}

	if (!violationReason) {
		violationReason = checkPaths(inputPaths);
	}

	if (!violationReason && toolName === "bash" && typeof record.command === "string") {
		const command = record.command;

		for (const rule of rules.bashToolPatterns) {
			const regex = new RegExp(rule.pattern);
			if (regex.test(command)) {
				violationReason = rule.reason;
				shouldAsk = !!rule.ask;
				break;
			}
		}

		if (!violationReason) {
			for (const zap of rules.zeroAccessPaths) {
				if (command.includes(zap)) {
					violationReason = `Bash command references zero-access path: ${zap}`;
					break;
				}
			}
		}

		if (!violationReason) {
			for (const rop of rules.readOnlyPaths) {
				if (
					command.includes(rop) &&
					(/[\s>|]/.test(command) ||
						command.includes("rm") ||
						command.includes("mv") ||
						command.includes("sed"))
				) {
					violationReason = `Bash command may modify read-only path: ${rop}`;
					break;
				}
			}
		}

		if (!violationReason) {
			for (const ndp of rules.noDeletePaths) {
				if (command.includes(ndp) && (command.includes("rm") || command.includes("mv"))) {
					violationReason = `Bash command attempts to delete/move protected path: ${ndp}`;
					break;
				}
			}
		}
	} else if (!violationReason && (toolName === "write" || toolName === "edit")) {
		for (const p of inputPaths) {
			const resolved = resolvePath(p, cwd);
			for (const rop of rules.readOnlyPaths) {
				if (isPathMatch(resolved, rop, cwd)) {
					violationReason = `Modification of read-only path restricted: ${rop}`;
					break;
				}
			}
		}
	}

	return { violationReason, shouldAsk };
}
