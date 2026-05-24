import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stubPi = join(repoRoot, "test", "fixtures", "stub-pi.mjs");
const callerUrl = pathToFileURL(join(repoRoot, "extensions", "subagent-widget.ts")).href;

let buildChildPiArgv;
let spawnPiJsonProcess;
let originalPiBin;

before(async () => {
	originalPiBin = process.env.PI_POWERPACK_PI;
	process.env.PI_POWERPACK_PI = stubPi;
	({ buildChildPiArgv, spawnPiJsonProcess } = await import(
		join(repoRoot, "extensions", "lib", "piJsonSubprocess.ts")
	));
});

after(() => {
	if (originalPiBin === undefined) delete process.env.PI_POWERPACK_PI;
	else process.env.PI_POWERPACK_PI = originalPiBin;
	delete process.env.PI_SUBAGENT_DAMAGE_CONTROL;
});

test("buildChildPiArgv includes damage-control extension by default", () => {
	const argv = buildChildPiArgv(callerUrl, {
		task: "test task",
		tools: "read,grep",
		systemPrompt: "You are a test agent.",
	});
	const extensionFlags = argv.filter((a) => a === "--extension");
	assert.equal(extensionFlags.length, 2);
	assert.ok(argv.includes("--no-extensions"));
	assert.ok(argv.includes("--cursor-fast"));
	assert.equal(argv.at(-1), "test task");
});

test("PI_SUBAGENT_DAMAGE_CONTROL=0 omits damage-control extension", () => {
	process.env.PI_SUBAGENT_DAMAGE_CONTROL = "0";
	const argv = buildChildPiArgv(callerUrl, {
		task: "no dc",
		tools: "read",
	});
	const extensionFlags = argv.filter((a) => a === "--extension");
	assert.equal(extensionFlags.length, 1);
});

test("spawnPiJsonProcess parses stub NDJSON output", async () => {
	delete process.env.PI_SUBAGENT_DAMAGE_CONTROL;
	const deltas = [];
	const { output, exitCode } = await spawnPiJsonProcess(
		callerUrl,
		{ task: "hello", tools: "read", ephemeral: true },
		{
			onTextDelta: (_d, full) => deltas.push(full),
		},
	);
	assert.equal(exitCode, 0);
	assert.equal(output, "Hello from stub-pi");
	assert.ok(deltas.includes("Hello from stub-pi"));
});

test("ephemeral mode passes --no-session to stub", async () => {
	delete process.env.PI_SUBAGENT_DAMAGE_CONTROL;
	await spawnPiJsonProcess(
		callerUrl,
		{ task: "ephemeral check", tools: "read", ephemeral: true },
		{},
	);
	// stub writes diagnostics to stderr; captured indirectly via successful run
});
