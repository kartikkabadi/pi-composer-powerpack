import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadPowerpackPaths() {
	return import(join(repoRoot, "extensions", "powerpackPaths.ts"));
}

// ── powerpackRoot ────────────────────────────────────────────────────────────

describe("powerpackRoot", () => {
	test("resolves to the repo root given import.meta.url from within extensions/", async () => {
		const { powerpackRoot } = await loadPowerpackPaths();
		const root = powerpackRoot(import.meta.url);
		assert.equal(root, repoRoot);
	});
});

// ── powerpackPath ────────────────────────────────────────────────────────────

describe("powerpackPath", () => {
	test("joins root with extra parts", async () => {
		const { powerpackPath } = await loadPowerpackPaths();
		const result = powerpackPath(import.meta.url, "agents");
		assert.equal(result, join(repoRoot, "agents"));
	});

	test("handles multiple path parts", async () => {
		const { powerpackPath } = await loadPowerpackPaths();
		const result = powerpackPath(import.meta.url, "extensions", "cursor-sdk.ts");
		assert.equal(result, join(repoRoot, "extensions", "cursor-sdk.ts"));
	});
});

// ── powerpackAgentsDir ───────────────────────────────────────────────────────

describe("powerpackAgentsDir", () => {
	test("resolves to repoRoot/agents", async () => {
		const { powerpackAgentsDir } = await loadPowerpackPaths();
		const result = powerpackAgentsDir(import.meta.url);
		assert.equal(result, join(repoRoot, "agents"));
	});
});

// ── powerpackCursorSdkExtension ──────────────────────────────────────────────

describe("powerpackCursorSdkExtension", () => {
	test("resolves to repoRoot/extensions/cursor-sdk.ts", async () => {
		const { powerpackCursorSdkExtension } = await loadPowerpackPaths();
		const result = powerpackCursorSdkExtension(import.meta.url);
		assert.equal(result, join(repoRoot, "extensions", "cursor-sdk.ts"));
	});
});

// ── piAgentHome ──────────────────────────────────────────────────────────────

describe("piAgentHome", () => {
	const ORIG_ENV = process.env.PI_CODING_AGENT_DIR;

	after(() => {
		if (ORIG_ENV === undefined) {
			delete process.env.PI_CODING_AGENT_DIR;
		} else {
			process.env.PI_CODING_AGENT_DIR = ORIG_ENV;
		}
	});

	test("returns PI_CODING_AGENT_DIR when set", async () => {
		process.env.PI_CODING_AGENT_DIR = "/custom/agent/path";
		const { piAgentHome } = await loadPowerpackPaths();
		assert.equal(piAgentHome(), "/custom/agent/path");
	});

	test("falls back to ~/.pi/agent when env var is not set", async () => {
		delete process.env.PI_CODING_AGENT_DIR;
		const { homedir } = await import("node:os");
		const { piAgentHome } = await loadPowerpackPaths();
		assert.equal(piAgentHome(), join(homedir(), ".pi", "agent"));
	});
});

// ── resolvePiBinary ──────────────────────────────────────────────────────────

describe("resolvePiBinary", () => {
	const ORIG_PI_POWERPACK_PI = process.env.PI_POWERPACK_PI;
	const ORIG_PI_BIN = process.env.PI_BIN;

	after(() => {
		process.env.PI_POWERPACK_PI = ORIG_PI_POWERPACK_PI;
		process.env.PI_BIN = ORIG_PI_BIN;
	});

	test("returns PI_POWERPACK_PI when set", async () => {
		process.env.PI_POWERPACK_PI = "/usr/local/bin/pi";
		delete process.env.PI_BIN;
		const { resolvePiBinary } = await loadPowerpackPaths();
		assert.equal(resolvePiBinary(), "/usr/local/bin/pi");
	});

	test("returns PI_BIN when PI_POWERPACK_PI is not set", async () => {
		delete process.env.PI_POWERPACK_PI;
		process.env.PI_BIN = "/opt/bin/pi";
		const { resolvePiBinary } = await loadPowerpackPaths();
		assert.equal(resolvePiBinary(), "/opt/bin/pi");
	});
});

// ── resolvePiSpawn ───────────────────────────────────────────────────────────

describe("resolvePiSpawn", () => {
	const ORIG_PI_POWERPACK_PI = process.env.PI_POWERPACK_PI;
	const ORIG_PI_BIN = process.env.PI_BIN;

	after(() => {
		process.env.PI_POWERPACK_PI = ORIG_PI_POWERPACK_PI;
		process.env.PI_BIN = ORIG_PI_BIN;
	});

	test("returns node command for .mjs scripts", async () => {
		process.env.PI_POWERPACK_PI = "/path/to/script.mjs";
		delete process.env.PI_BIN;
		const { resolvePiSpawn } = await loadPowerpackPaths();
		const result = resolvePiSpawn();
		assert.equal(result.command, process.execPath);
		assert.deepEqual(result.prefixArgs, ["/path/to/script.mjs"]);
	});

	test("returns node command for .js scripts", async () => {
		process.env.PI_POWERPACK_PI = "/path/to/script.js";
		delete process.env.PI_BIN;
		const { resolvePiSpawn } = await loadPowerpackPaths();
		const result = resolvePiSpawn();
		assert.equal(result.command, process.execPath);
		assert.deepEqual(result.prefixArgs, ["/path/to/script.js"]);
	});

	test("returns binary command for non-script paths", async () => {
		process.env.PI_POWERPACK_PI = "/usr/local/bin/pi";
		delete process.env.PI_BIN;
		const { resolvePiSpawn } = await loadPowerpackPaths();
		const result = resolvePiSpawn();
		assert.equal(result.command, "/usr/local/bin/pi");
		assert.deepEqual(result.prefixArgs, []);
	});
});
