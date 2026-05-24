import * as os from "node:os";
import * as path from "node:path";

export type BashRule = {
	pattern: string;
	reason: string;
	ask?: boolean;
};

export type DamageControlRules = {
	bashToolPatterns: BashRule[];
	zeroAccessPaths: string[];
	readOnlyPaths: string[];
	noDeletePaths: string[];
};

export type ToolCallEvaluation = {
	violationReason: string | null;
	shouldAsk: boolean;
};

function resolvePath(p: string, cwd: string): string {
	let target = p;
	if (target.startsWith("~")) {
		target = path.join(os.homedir(), target.slice(1));
	}
	return path.resolve(cwd, target);
}

function isPathMatch(targetPath: string, pattern: string, cwd: string): boolean {
	const resolvedPattern = pattern.startsWith("~")
		? path.join(os.homedir(), pattern.slice(1))
		: pattern;

	if (resolvedPattern.endsWith("/")) {
		const absolutePattern = path.isAbsolute(resolvedPattern)
			? resolvedPattern
			: path.resolve(cwd, resolvedPattern);
		return targetPath.startsWith(absolutePattern);
	}

	const regexPattern = resolvedPattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");

	const regex = new RegExp(
		`^${regexPattern}$|^${regexPattern}/|/${regexPattern}$|/${regexPattern}/`,
	);

	const relativePath = path.relative(cwd, targetPath);

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
