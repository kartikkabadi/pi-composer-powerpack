import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("scanAgents finds pi-pi subdirectory experts", async () => {
	const { scanAgents } = await import(join(repoRoot, "extensions", "lib", "agentDefinitions.ts"));
	const agents = scanAgents({
		cwd: repoRoot,
		packageAgentsDir: join(repoRoot, "agents"),
		includePiPiSubdir: true,
	});
	assert.ok(agents.has("cli-expert"), "cli-expert should be discoverable");
	assert.ok(agents.has("keybinding-expert"), "keybinding-expert should be discoverable");
	assert.ok(agents.has("scout"), "top-level scout agent should be discoverable");
});

test("loadTeamsYaml parses pi-pi team", async () => {
	const { loadTeamsYaml } = await import(join(repoRoot, "extensions", "lib", "agentDefinitions.ts"));
	const { readFileSync } = await import("node:fs");
	const raw = readFileSync(join(repoRoot, "agents", "teams.yaml"), "utf-8");
	const teams = loadTeamsYaml(raw);
	assert.ok(Array.isArray(teams["pi-pi"]));
	assert.ok(teams["pi-pi"].includes("cli-expert"));
	assert.ok(teams["pi-pi"].includes("keybinding-expert"));
});
