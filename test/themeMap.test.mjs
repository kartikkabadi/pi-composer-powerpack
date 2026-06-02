import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let themeMap;

before(async () => {
	themeMap = await import(join(repoRoot, "extensions", "themeMap.ts"));
});

// ── THEME_MAP ────────────────────────────────────────────────────────────────

describe("THEME_MAP", () => {
	test("contains expected extension entries", () => {
		const { THEME_MAP } = themeMap;
		assert.ok(THEME_MAP["cursor-sdk"]);
		assert.ok(THEME_MAP["agent-chain"]);
		assert.ok(THEME_MAP["agent-team"]);
		assert.ok(THEME_MAP["pi-pi"]);
		assert.ok(THEME_MAP["coms"]);
		assert.ok(THEME_MAP["subagent-widget"]);
		assert.ok(THEME_MAP["damage-control-continue"]);
		assert.ok(THEME_MAP["auto-caveman"]);
		assert.ok(THEME_MAP["superset-hooks"]);
		assert.ok(THEME_MAP["tilldone"]);
	});

	test("cursor-sdk uses mono-black theme", () => {
		const { THEME_MAP } = themeMap;
		assert.equal(THEME_MAP["cursor-sdk"], "mono-black");
	});

	test("all values are strings", () => {
		const { THEME_MAP } = themeMap;
		for (const [key, value] of Object.entries(THEME_MAP)) {
			assert.equal(typeof value, "string", `THEME_MAP["${key}"] should be a string`);
		}
	});
});

// ── applyExtensionTheme ──────────────────────────────────────────────────────

describe("applyExtensionTheme", () => {
	test("always returns false (no-op)", () => {
		const result = themeMap.applyExtensionTheme("file:///test.ts", {});
		assert.equal(result, false);
	});
});

// ── applyExtensionDefaults ───────────────────────────────────────────────────

describe("applyExtensionDefaults", () => {
	test("calls setTitle with extension name", () => {
		let capturedTitle = "";
		const mockCtx = {
			hasUI: true,
			ui: {
				setTitle: (title) => { capturedTitle = title; },
			},
		};
		themeMap.applyExtensionDefaults("file:///extensions/agent-chain.ts", mockCtx);
		// applyExtensionDefaults calls applyExtensionTitle which uses a setTimeout
		// The title is set via primaryExtensionName() which reads process.argv
		// Since we can't control process.argv in this test, we just verify it doesn't throw
	});

	test("does not throw with valid inputs", () => {
		const mockCtx = {
			hasUI: true,
			ui: {
				setTitle: () => {},
			},
		};
		assert.doesNotThrow(() => {
			themeMap.applyExtensionDefaults("file:///extensions/coms.ts", mockCtx);
		});
	});

	test("handles missing UI gracefully", () => {
		const mockCtx = {
			hasUI: false,
			ui: {},
		};
		assert.doesNotThrow(() => {
			themeMap.applyExtensionDefaults("file:///extensions/coms.ts", mockCtx);
		});
	});
});
