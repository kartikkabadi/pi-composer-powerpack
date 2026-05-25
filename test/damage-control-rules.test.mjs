import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let evaluateToolCall;

test("load evaluateToolCall", async () => {
	({ evaluateToolCall } = await import(
		join(repoRoot, "extensions", "lib", "damageControlRules.ts")
	));
});

// ── Table-driven tests ──────────────────────────────────────────────────────

const fullRules = parseYaml(readFileSync(join(repoRoot, "config", "damage-control-rules.yaml"), "utf-8"));

const bashBlockTable = [
	{ cmd: "rm -rf /tmp/x",                  label: "rm -rf" },
	{ cmd: "sudo rm /etc/hosts",             label: "sudo rm" },
	{ cmd: "git reset --hard HEAD~1",        label: "git reset --hard" },
	{ cmd: "git push origin --force main",   label: "git push --force" },
	{ cmd: "git push -f origin main",        label: "git push -f" },
	{ cmd: "git clean -fd",                  label: "git clean -fd" },
	{ cmd: "git stash clear",               label: "git stash clear" },
	{ cmd: "chmod 777 .",                    label: "chmod 777" },
	{ cmd: "mkfs.ext4 /dev/sda1",           label: "mkfs" },
	{ cmd: "kill -9 -1",                    label: "kill all" },
	{ cmd: "aws s3 rm s3://bucket --recursive", label: "aws s3 rm --recursive" },
	{ cmd: "DROP TABLE users",              label: "DROP TABLE" },
	{ cmd: "TRUNCATE TABLE logs",           label: "TRUNCATE TABLE" },
	{ cmd: "gcloud projects delete my-proj", label: "gcloud projects delete" },
	{ cmd: "vercel remove foo --yes",       label: "vercel remove --yes" },
	{ cmd: "firebase projects:delete foo",  label: "firebase projects:delete" },
	{ cmd: "wrangler delete worker-name",   label: "wrangler delete" },
];

for (const { cmd, label } of bashBlockTable) {
	test(`evaluateToolCall blocks bash: ${label}`, () => {
		const result = evaluateToolCall(fullRules, "bash", { command: cmd }, repoRoot);
		assert.ok(result.violationReason, `Expected violation for: ${cmd}`);
	});
}

const bashAskTable = [
	{ cmd: "git checkout -- .",              label: "git checkout -- ." },
	{ cmd: "git stash drop",                label: "git stash drop" },
	{ cmd: "git branch -D feature",         label: "git branch -D" },
	{ cmd: "DELETE FROM users WHERE id = 1", label: "SQL DELETE with id" },
];

for (const { cmd, label } of bashAskTable) {
	test(`evaluateToolCall ask for bash: ${label}`, () => {
		const result = evaluateToolCall(fullRules, "bash", { command: cmd }, repoRoot);
		assert.ok(result.violationReason, `Expected violation for: ${cmd}`);
		assert.equal(result.shouldAsk, true, `Expected shouldAsk for: ${cmd}`);
	});
}

const bashAllowTable = [
	{ cmd: "echo hello",                    label: "echo" },
	{ cmd: "ls -la",                        label: "ls" },
	{ cmd: "git status",                    label: "git status" },
	{ cmd: "git commit -m 'test'",          label: "git commit" },
	{ cmd: "git push origin main",          label: "git push (no force)" },
	{ cmd: "npm test",                      label: "npm test" },
	{ cmd: "cat README.md",                 label: "cat" },
];

for (const { cmd, label } of bashAllowTable) {
	test(`evaluateToolCall allows bash: ${label}`, () => {
		const result = evaluateToolCall(fullRules, "bash", { command: cmd }, repoRoot);
		assert.equal(result.violationReason, null, `Unexpected violation for: ${cmd}`);
	});
}

// ── Zero-access path tests ──────────────────────────────────────────────────

test("evaluateToolCall blocks read of .env", () => {
	const result = evaluateToolCall(fullRules, "read", { path: join(repoRoot, ".env") }, repoRoot);
	assert.ok(result.violationReason, "Expected violation for .env read");
});

test("evaluateToolCall blocks read of ~/.ssh/", () => {
	const result = evaluateToolCall(fullRules, "read", { path: "~/.ssh/id_rsa" }, repoRoot);
	assert.ok(result.violationReason, "Expected violation for ~/.ssh read");
});

// ── Read-only path tests ────────────────────────────────────────────────────

test("evaluateToolCall blocks write to read-only path", () => {
	const result = evaluateToolCall(
		fullRules,
		"write",
		{ path: join(repoRoot, "package-lock.json"), content: "x" },
		repoRoot,
	);
	assert.match(result.violationReason ?? "", /read-only/);
});

test("evaluateToolCall blocks edit to pnpm-lock.yaml", () => {
	const result = evaluateToolCall(
		fullRules,
		"edit",
		{ path: join(repoRoot, "pnpm-lock.yaml"), content: "x" },
		repoRoot,
	);
	assert.match(result.violationReason ?? "", /read-only/);
});

// ── No-delete path tests ────────────────────────────────────────────────────

test("evaluateToolCall blocks rm of .git/", () => {
	const result = evaluateToolCall(
		fullRules,
		"bash",
		{ command: "rm -r .git/" },
		repoRoot,
	);
	assert.ok(result.violationReason, "Expected violation for .git rm");
});

test("evaluateToolCall blocks rm of LICENSE", () => {
	const result = evaluateToolCall(
		fullRules,
		"bash",
		{ command: "rm LICENSE" },
		repoRoot,
	);
	assert.ok(result.violationReason, "Expected violation for LICENSE rm");
});
