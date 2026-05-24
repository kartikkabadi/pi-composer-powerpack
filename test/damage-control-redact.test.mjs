import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("sanitizeToolInput redacts secrets in bash commands", async () => {
	const { sanitizeToolInput } = await import(
		join(repoRoot, "extensions", "damage-control-continue.ts")
	);
	const input = { command: "curl -H 'Authorization: Bearer sk-abc123secret'" };
	const sanitized = sanitizeToolInput("bash", input);
	assert.match(String(sanitized.command), /\[REDACTED\]/);
	assert.doesNotMatch(String(sanitized.command), /sk-abc123secret/);
});

test("sanitizeToolInput truncates long write content", async () => {
	const { sanitizeToolInput } = await import(
		join(repoRoot, "extensions", "damage-control-continue.ts")
	);
	const long = "x".repeat(300);
	const sanitized = sanitizeToolInput("write", { content: long, path: "/tmp/x" });
	assert.ok(String(sanitized.content).length < long.length);
	assert.match(String(sanitized.content), /truncated/);
});

test("PI_DAMAGE_CONTROL_LOG_RAW=1 preserves raw input", async () => {
	process.env.PI_DAMAGE_CONTROL_LOG_RAW = "1";
	const { sanitizeToolInput } = await import(
		join(repoRoot, "extensions", "damage-control-continue.ts")
	);
	const input = { command: "export API_KEY=supersecret" };
	const sanitized = sanitizeToolInput("bash", input);
	assert.equal(sanitized.command, input.command);
	delete process.env.PI_DAMAGE_CONTROL_LOG_RAW;
});
