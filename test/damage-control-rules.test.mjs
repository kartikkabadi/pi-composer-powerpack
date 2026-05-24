import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("evaluateToolCall blocks bash matching pattern", async () => {
	const { evaluateToolCall } = await import(
		join(repoRoot, "extensions", "lib", "damageControlRules.ts")
	);
	const rules = {
		bashToolPatterns: [{ pattern: "rm -rf /", reason: "destructive rm" }],
		zeroAccessPaths: [],
		readOnlyPaths: [],
		noDeletePaths: [],
	};
	const result = evaluateToolCall(rules, "bash", { command: "rm -rf /tmp/x" }, repoRoot);
	assert.equal(result.violationReason, "destructive rm");
});

test("evaluateToolCall allows benign bash", async () => {
	const { evaluateToolCall } = await import(
		join(repoRoot, "extensions", "lib", "damageControlRules.ts")
	);
	const rules = {
		bashToolPatterns: [{ pattern: "rm -rf /", reason: "destructive rm" }],
		zeroAccessPaths: [],
		readOnlyPaths: [],
		noDeletePaths: [],
	};
	const result = evaluateToolCall(rules, "bash", { command: "echo hello" }, repoRoot);
	assert.equal(result.violationReason, null);
});

test("evaluateToolCall blocks write to read-only path", async () => {
	const { evaluateToolCall } = await import(
		join(repoRoot, "extensions", "lib", "damageControlRules.ts")
	);
	const rules = {
		bashToolPatterns: [],
		zeroAccessPaths: [],
		readOnlyPaths: ["package-lock.json"],
		noDeletePaths: [],
	};
	const result = evaluateToolCall(
		rules,
		"write",
		{ path: join(repoRoot, "package-lock.json"), content: "x" },
		repoRoot,
	);
	assert.match(result.violationReason ?? "", /read-only/);
});
