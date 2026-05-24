import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("blocked bash feedback redacts secrets in invocation", async () => {
	const { redactInvocation } = await import(
		join(repoRoot, "extensions", "damage-control-continue.ts")
	);
	const rawSecret = "sk-live-abc123notforshow";
	const invocation = redactInvocation("bash", {
		command: `curl -H "Authorization: Bearer ${rawSecret}"`,
	});
	assert.match(invocation, /\[REDACTED\]/);
	assert.ok(!invocation.includes(rawSecret), "invocation must not contain raw secret");

	// Block reason embeds invocation (see continueFeedback)
	const reason = `Attempted: ${invocation}`;
	assert.match(reason, /\[REDACTED\]/);
	assert.ok(!reason.includes(rawSecret), "reason must not contain raw secret");
});
