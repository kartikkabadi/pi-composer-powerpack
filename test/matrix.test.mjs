import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const teamsPath = join(repoRoot, "agents", "teams.yaml");
const piPiDir = join(repoRoot, "agents", "pi-pi");
const readmePath = join(repoRoot, "README.md");

function loadPiPiTeam() {
	const raw = readFileSync(teamsPath, "utf-8");
	const teams = parseYaml(raw);
	return teams["pi-pi"] ?? [];
}

function listPiPiExperts() {
	return readdirSync(piPiDir)
		.filter((f) => f.endsWith(".md") && f !== "pi-orchestrator.md")
		.map((f) => f.replace(/\.md$/, ""));
}

test("pi-pi team members resolve to agents/pi-pi/*.md", () => {
	const team = loadPiPiTeam();
	const onDisk = new Set(listPiPiExperts());
	for (const member of team) {
		assert.ok(onDisk.has(member), `teams.yaml pi-pi member "${member}" missing from agents/pi-pi/`);
	}
});

test("every agents/pi-pi expert (except orchestrator) is in pi-pi team", () => {
	const team = new Set(loadPiPiTeam());
	for (const expert of listPiPiExperts()) {
		assert.ok(team.has(expert), `agents/pi-pi/${expert}.md not listed in teams.yaml pi-pi team`);
	}
});

test("README agent counts match disk", () => {
	const readme = readFileSync(readmePath, "utf-8");
	const generalAgents = readdirSync(join(repoRoot, "agents")).filter((f) => f.endsWith(".md")).length;
	const piPiExperts = listPiPiExperts().length;

	const generalMatch = readme.match(/(\d+) general agents/);
	assert.ok(generalMatch, "README should mention general agent count");
	assert.equal(Number(generalMatch[1]), generalAgents);

	const expertMatch = readme.match(/(\d+) Pi-Pi experts/);
	assert.ok(expertMatch, "README should mention Pi-Pi expert count");
	assert.equal(Number(expertMatch[1]), piPiExperts);
});
