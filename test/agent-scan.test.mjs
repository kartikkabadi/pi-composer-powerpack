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
