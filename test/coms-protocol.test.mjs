import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadProtocol() {
	return import(join(repoRoot, "extensions", "coms", "protocol.ts"));
}

// ── ulid ────────────────────────────────────────────────────────────────────

describe("ulid", () => {
	test("returns a 26-character string", async () => {
		const { ulid } = await loadProtocol();
		const id = ulid();
		assert.equal(typeof id, "string");
		assert.equal(id.length, 26);
	});

	test("uses only Crockford base32 characters", async () => {
		const { ulid } = await loadProtocol();
		const id = ulid();
		assert.match(id, /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
	});

	test("generates unique IDs on successive calls", async () => {
		const { ulid } = await loadProtocol();
		const ids = new Set(Array.from({ length: 100 }, () => ulid()));
		assert.equal(ids.size, 100, "all 100 ULIDs should be unique");
	});
});

// ── hexFg ───────────────────────────────────────────────────────────────────

describe("hexFg", () => {
	test("wraps string with ANSI 24-bit color escape codes", async () => {
		const { hexFg } = await loadProtocol();
		const result = hexFg("#FF0000", "hello");
		assert.equal(result, "\x1b[38;2;255;0;0mhello\x1b[39m");
	});

	test("handles lowercase hex", async () => {
		const { hexFg } = await loadProtocol();
		const result = hexFg("#00ff00", "test");
		assert.equal(result, "\x1b[38;2;0;255;0mtest\x1b[39m");
	});

	test("handles mixed case hex", async () => {
		const { hexFg } = await loadProtocol();
		const result = hexFg("#aAbBcC", "mixed");
		assert.equal(result, "\x1b[38;2;170;187;204mmixed\x1b[39m");
	});
});

// ── isValidHex ──────────────────────────────────────────────────────────────

describe("isValidHex", () => {
	test("valid 6-digit hex with #", async () => {
		const { isValidHex } = await loadProtocol();
		assert.equal(isValidHex("#FF0000"), true);
		assert.equal(isValidHex("#000000"), true);
		assert.equal(isValidHex("#ffffff"), true);
		assert.equal(isValidHex("#a1b2c3"), true);
	});

	test("invalid hex strings", async () => {
		const { isValidHex } = await loadProtocol();
		assert.equal(isValidHex("FF0000"), false);     // missing #
		assert.equal(isValidHex("#FFF"), false);        // too short
		assert.equal(isValidHex("#FFFFFFFF"), false);   // too long
		assert.equal(isValidHex("#GGHHII"), false);     // non-hex chars
		assert.equal(isValidHex(""), false);            // empty
		assert.equal(isValidHex("#12345"), false);      // 5 chars
		assert.equal(isValidHex("#1234567"), false);    // 7 chars
	});
});

// ── fallbackColor ───────────────────────────────────────────────────────────

describe("fallbackColor", () => {
	test("returns a hex color string from the palette", async () => {
		const { fallbackColor } = await loadProtocol();
		const color = fallbackColor("test-session-1");
		assert.match(color, /^#[0-9a-fA-F]{6}$/);
	});

	test("is deterministic for the same session ID", async () => {
		const { fallbackColor } = await loadProtocol();
		const c1 = fallbackColor("abc-123");
		const c2 = fallbackColor("abc-123");
		assert.equal(c1, c2);
	});

	test("produces different colors for different session IDs", async () => {
		const { fallbackColor } = await loadProtocol();
		const colors = new Set(
			Array.from({ length: 20 }, (_, i) => fallbackColor(`session-${i}`)),
		);
		assert.ok(colors.size > 1, "should produce at least 2 distinct colors");
	});
});

// ── parseFrontmatter ────────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
	test("extracts name, description, color from frontmatter", async () => {
		const { parseFrontmatter } = await loadProtocol();
		const raw = "---\nname: agent-x\ndescription: A test agent\ncolor: #FF00FF\n---\n\nBody content here.\n";
		const result = parseFrontmatter(raw);
		assert.equal(result.name, "agent-x");
		assert.equal(result.description, "A test agent");
		assert.equal(result.color, "#FF00FF");
		assert.match(result.body, /Body content here/);
	});

	test("returns undefined for missing fields", async () => {
		const { parseFrontmatter } = await loadProtocol();
		const raw = "---\nname: only-name\n---\n\nBody.\n";
		const result = parseFrontmatter(raw);
		assert.equal(result.name, "only-name");
		assert.equal(result.description, undefined);
		assert.equal(result.color, undefined);
	});

	test("handles empty frontmatter", async () => {
		const { parseFrontmatter } = await loadProtocol();
		const raw = "---\n---\n\nJust body.\n";
		const result = parseFrontmatter(raw);
		assert.equal(result.name, undefined);
		assert.equal(result.description, undefined);
		assert.equal(result.color, undefined);
		assert.match(result.body, /Just body/);
	});
});

// ── makeEndpoint ────────────────────────────────────────────────────────────

describe("makeEndpoint", () => {
	test("returns a socket path containing the session ID on non-Windows", async () => {
		const { makeEndpoint } = await loadProtocol();
		if (process.platform !== "win32") {
			const ep = makeEndpoint("my-session");
			assert.ok(ep.includes("my-session"), "endpoint should contain session ID");
			assert.ok(ep.endsWith(".sock"), "endpoint should end with .sock");
		}
	});
});

// ── nowIso ──────────────────────────────────────────────────────────────────

describe("nowIso", () => {
	test("returns a valid ISO 8601 timestamp", async () => {
		const { nowIso } = await loadProtocol();
		const ts = nowIso();
		const parsed = new Date(ts);
		assert.ok(!isNaN(parsed.getTime()), "should be a valid date");
		assert.equal(ts, parsed.toISOString());
	});

	test("returns a recent timestamp", async () => {
		const { nowIso } = await loadProtocol();
		const before = Date.now();
		const ts = nowIso();
		const after = Date.now();
		const t = new Date(ts).getTime();
		assert.ok(t >= before - 1000, "timestamp should be >= before");
		assert.ok(t <= after + 1000, "timestamp should be <= after");
	});
});

// ── makePingEnvelope ────────────────────────────────────────────────────────

describe("makePingEnvelope", () => {
	test("creates a valid ping envelope", async () => {
		const { makePingEnvelope } = await loadProtocol();
		const env = makePingEnvelope("session-abc", "unix:///tmp/test.sock");
		assert.equal(env.type, "ping");
		assert.equal(typeof env.msg_id, "string");
		assert.equal(env.msg_id.length, 26);
		assert.equal(env.sender_session, "session-abc");
		assert.equal(env.sender_endpoint, "unix:///tmp/test.sock");
		assert.equal(env.hops, 0);
		assert.equal(typeof env.timestamp, "string");
		const parsed = new Date(env.timestamp);
		assert.ok(!isNaN(parsed.getTime()), "timestamp should be valid ISO");
	});
});

// ── abbreviateModel ─────────────────────────────────────────────────────────

describe("abbreviateModel", () => {
	test("strips 'claude-' prefix", async () => {
		const { abbreviateModel } = await loadProtocol();
		// After stripping prefix, "sonnet-4-20250514" (18 chars) is truncated to 14
		assert.equal(abbreviateModel("claude-sonnet-4-20250514"), "sonnet-4-20250");
	});

	test("truncates to 14 characters", async () => {
		const { abbreviateModel } = await loadProtocol();
		const result = abbreviateModel("claude-sonnet-4-20250514");
		assert.ok(result.length <= 14);
	});

	test("returns short model names unchanged (after prefix strip)", async () => {
		const { abbreviateModel } = await loadProtocol();
		assert.equal(abbreviateModel("claude-haiku"), "haiku");
	});

	test("handles empty string", async () => {
		const { abbreviateModel } = await loadProtocol();
		assert.equal(abbreviateModel(""), "");
	});

	test("handles model without claude- prefix", async () => {
		const { abbreviateModel } = await loadProtocol();
		const result = abbreviateModel("gpt-4-turbo");
		assert.equal(result.length, Math.min("gpt-4-turbo".length, 14));
	});
});

// ── isValidEnvelope ─────────────────────────────────────────────────────────

describe("isValidEnvelope", () => {
	test("valid envelope object", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.equal(isValidEnvelope({
			type: "prompt",
			msg_id: "01ABC",
			sender_session: "s1",
			sender_endpoint: "ep1",
			hops: 0,
			timestamp: "2025-01-01T00:00:00Z",
		}), true);
	});

	test("null/undefined is invalid", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.ok(!isValidEnvelope(null));
		assert.ok(!isValidEnvelope(undefined));
	});

	test("missing type field is invalid", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.equal(isValidEnvelope({
			msg_id: "01ABC",
			sender_session: "s1",
			sender_endpoint: "ep1",
		}), false);
	});

	test("missing msg_id is invalid", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.equal(isValidEnvelope({
			type: "ping",
			sender_session: "s1",
			sender_endpoint: "ep1",
		}), false);
	});

	test("non-object is invalid", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.equal(isValidEnvelope("string"), false);
		assert.equal(isValidEnvelope(42), false);
		assert.equal(isValidEnvelope(true), false);
	});

	test("missing sender_session is invalid", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.equal(isValidEnvelope({
			type: "ping",
			msg_id: "01ABC",
			sender_endpoint: "ep1",
		}), false);
	});

	test("missing sender_endpoint is invalid", async () => {
		const { isValidEnvelope } = await loadProtocol();
		assert.equal(isValidEnvelope({
			type: "ping",
			msg_id: "01ABC",
			sender_session: "s1",
		}), false);
	});
});

// ── findSystemPromptPath ────────────────────────────────────────────────────

describe("findSystemPromptPath", () => {
	test("finds --system-prompt with .md file", async () => {
		const { findSystemPromptPath } = await loadProtocol();
		const dir = mkdtempSync(join(tmpdir(), "proto-test-"));
		const mdPath = join(dir, "prompt.md");
		writeFileSync(mdPath, "test content");
		const result = findSystemPromptPath(["--system-prompt", mdPath]);
		assert.equal(result, mdPath);
		rmSync(dir, { recursive: true });
	});

	test("finds --append-system-prompt with .md file", async () => {
		const { findSystemPromptPath } = await loadProtocol();
		const dir = mkdtempSync(join(tmpdir(), "proto-test-"));
		const mdPath = join(dir, "append.md");
		writeFileSync(mdPath, "append content");
		const result = findSystemPromptPath(["--append-system-prompt", mdPath]);
		assert.equal(result, mdPath);
		rmSync(dir, { recursive: true });
	});

	test("returns null when no flag found", async () => {
		const { findSystemPromptPath } = await loadProtocol();
		assert.equal(findSystemPromptPath(["--other-flag", "file.md"]), null);
	});

	test("returns null for non-.md file", async () => {
		const { findSystemPromptPath } = await loadProtocol();
		const dir = mkdtempSync(join(tmpdir(), "proto-test-"));
		const txtPath = join(dir, "prompt.txt");
		writeFileSync(txtPath, "content");
		assert.equal(findSystemPromptPath(["--system-prompt", txtPath]), null);
		rmSync(dir, { recursive: true });
	});

	test("returns null when file does not exist", async () => {
		const { findSystemPromptPath } = await loadProtocol();
		assert.equal(findSystemPromptPath(["--system-prompt", "/nonexistent/file.md"]), null);
	});

	test("--system-prompt takes precedence over --append-system-prompt", async () => {
		const { findSystemPromptPath } = await loadProtocol();
		const dir = mkdtempSync(join(tmpdir(), "proto-test-"));
		const md1 = join(dir, "first.md");
		const md2 = join(dir, "second.md");
		writeFileSync(md1, "first");
		writeFileSync(md2, "second");
		const result = findSystemPromptPath([
			"--system-prompt", md1,
			"--append-system-prompt", md2,
		]);
		assert.equal(result, md1);
		rmSync(dir, { recursive: true });
	});
});
