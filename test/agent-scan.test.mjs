import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

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

test("parseMarkdownFrontmatter extracts fields and body", async () => {
	const { parseMarkdownFrontmatter } = await import(
		join(repoRoot, "extensions", "lib", "frontmatter.ts")
	);
	const raw = `---\nname: test-expert\ndescription: A test\ntools: read\n---\n\nBody here.\n`;
	const { fields, body } = parseMarkdownFrontmatter(raw);
	assert.equal(fields.name, "test-expert");
	assert.equal(fields.tools, "read");
	assert.match(body, /Body here/);
});

test("loadPiPiExperts resolves bundled experts with project override precedence", async () => {
	const { loadPiPiExperts } = await import(
		join(repoRoot, "extensions", "lib", "agentDefinitions.ts")
	);
	const experts = loadPiPiExperts(repoRoot, join(repoRoot, "agents"));
	assert.ok(experts.has("cli-expert"));
	assert.ok(experts.has("ext-expert"));
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

test("scanAgents project .pi/agents overrides package agent (first-seen wins)", async () => {
	const { scanAgents } = await import(join(repoRoot, "extensions", "lib", "agentDefinitions.ts"));
	const tmpDir = mkdtempSync(join(tmpdir(), "precedence-"));
	const piAgentsDir = join(tmpDir, ".pi", "agents");
	mkdirSync(piAgentsDir, { recursive: true });
	writeFileSync(join(piAgentsDir, "scout.md"), "---\nname: scout\ndescription: project override\ntools: read\n---\nProject scout.");

	try {
		const agents = scanAgents({
			cwd: tmpDir,
			packageAgentsDir: join(repoRoot, "agents"),
			includePiPiSubdir: false,
		});
		const scout = agents.get("scout");
		assert.ok(scout, "scout should be found");
		assert.equal(scout.description, "project override", "project-level scout should win over package");
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("mergeChains replaces chain by name (last wins)", async () => {
	const { mergeChains } = await import(join(repoRoot, "extensions", "lib", "agentDefinitions.ts"));
	const base = [{ name: "foo", description: "base", steps: [{ agent: "a", prompt: "x" }] }];
	const overlay = [{ name: "foo", description: "overlay", steps: [{ agent: "b", prompt: "y" }] }];
	const merged = mergeChains(base, overlay);
	assert.equal(merged.length, 1);
	assert.equal(merged[0].description, "overlay");
	assert.equal(merged[0].steps[0].agent, "b");
});

test("mergeTeams replaces team by name (last wins)", async () => {
	const { mergeTeams } = await import(join(repoRoot, "extensions", "lib", "agentDefinitions.ts"));
	const base = { dev: ["scout", "builder"] };
	const overlay = { dev: ["planner"] };
	const merged = mergeTeams(base, overlay);
	assert.deepEqual(merged.dev, ["planner"]);
});
