import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Single temp dir for all tests, set BEFORE module import ─────────────────

const tmpDir = mkdtempSync(join(tmpdir(), "coms-registry-test-"));
process.env.PI_COMS_DIR = tmpDir;

let registry;
let types;

// All module-loading happens once in before(), BEFORE any test runs,
// so COMS_DIR (evaluated at module load time) is correctly set to tmpDir.
before(async () => {
	registry = await import(join(repoRoot, "extensions", "coms", "registry.ts"));
	types = await import(join(repoRoot, "extensions", "coms", "types.ts"));
});

after(() => {
	delete process.env.PI_COMS_DIR;
	try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(overrides = {}) {
	return {
		session_id: "ses_test123",
		name: "test-agent",
		purpose: "testing",
		model: "claude-sonnet-4-20250514",
		color: "#72F1B8",
		pid: process.pid,
		endpoint: "/tmp/test.sock",
		cwd: "/tmp",
		started_at: new Date().toISOString(),
		explicit: true,
		version: 1,
		...overrides,
	};
}

function seedProject(project, entries = []) {
	const dir = join(tmpDir, "projects", project, "agents");
	try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
	mkdirSync(dir, { recursive: true });
	for (const entry of entries) {
		writeFileSync(join(dir, `${entry.name}.json`), JSON.stringify(entry, null, 2));
	}
}

// ── projectAgentsDir ────────────────────────────────────────────────────────

describe("projectAgentsDir", () => {
	test("returns path under COMS_DIR/projects/<name>/agents", () => {
		const result = registry.projectAgentsDir("my-project");
		assert.equal(result, join(tmpDir, "projects", "my-project", "agents"));
	});
});

// ── registryFilePath ────────────────────────────────────────────────────────

describe("registryFilePath", () => {
	test("returns path to agent JSON file", () => {
		const result = registry.registryFilePath("my-project", "scout");
		assert.equal(result, join(tmpDir, "projects", "my-project", "agents", "scout.json"));
	});
});

// ── writeRegistryAtomic ─────────────────────────────────────────────────────

describe("writeRegistryAtomic", () => {
	test("writes entry to JSON file on disk", () => {
		const entry = makeEntry({ name: "writer-agent", session_id: "ses_w1" });
		const filePath = registry.writeRegistryAtomic(entry, "proj-write");
		assert.ok(existsSync(filePath));
		const raw = readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(raw);
		assert.equal(parsed.name, "writer-agent");
		assert.equal(parsed.session_id, "ses_w1");
	});

	test("creates project dir when missing", () => {
		const dir = join(tmpDir, "projects", "proj-newdir", "agents");
		try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
		assert.ok(!existsSync(dir));

		registry.writeRegistryAtomic(makeEntry({ name: "a1" }), "proj-newdir");
		assert.ok(existsSync(dir));
	});

	test("uses atomic .tmp rename (no .tmp residue)", () => {
		const finalPath = join(tmpDir, "projects", "proj-atomic", "agents", "atom.json");
		const tmpPath = finalPath + ".tmp";
		try { rmSync(finalPath, { force: true }); } catch { /* ignore */ }
		try { rmSync(tmpPath, { force: true }); } catch { /* ignore */ }

		registry.writeRegistryAtomic(makeEntry({ name: "atom" }), "proj-atomic");
		assert.ok(existsSync(finalPath));
		assert.ok(!existsSync(tmpPath));
	});

	test("returns the final file path", () => {
		const filePath = registry.writeRegistryAtomic(makeEntry({ name: "ret" }), "proj-ret");
		assert.equal(filePath, join(tmpDir, "projects", "proj-ret", "agents", "ret.json"));
	});
});

// ── readAllRegistryEntries ──────────────────────────────────────────────────

describe("readAllRegistryEntries", () => {
	test("returns [] for non-existent project dir", () => {
		assert.deepEqual(registry.readAllRegistryEntries("nonexistent-project"), []);
	});

	test("returns [] for empty project dir", () => {
		seedProject("proj-empty", []);
		assert.deepEqual(registry.readAllRegistryEntries("proj-empty"), []);
	});

	test("reads multiple valid entries", () => {
		seedProject("proj-multi", [
			makeEntry({ name: "a1", session_id: "s1" }),
			makeEntry({ name: "a2", session_id: "s2" }),
		]);
		const entries = registry.readAllRegistryEntries("proj-multi");
		assert.equal(entries.length, 2);
		const names = entries.map((e) => e.name).sort();
		assert.deepEqual(names, ["a1", "a2"]);
	});

	test("skips non-.json files", () => {
		seedProject("proj-nonjson", [makeEntry({ name: "good", session_id: "g1" })]);
		const dir = join(tmpDir, "projects", "proj-nonjson", "agents");
		writeFileSync(join(dir, "notes.txt"), "not json");
		const entries = registry.readAllRegistryEntries("proj-nonjson");
		assert.equal(entries.length, 1);
	});

	test("skips malformed JSON", () => {
		seedProject("proj-badjson", []);
		const dir = join(tmpDir, "projects", "proj-badjson", "agents");
		writeFileSync(join(dir, "bad.json"), "{ not json");
		writeFileSync(join(dir, "good.json"), JSON.stringify(makeEntry({ name: "good", session_id: "g1" })));
		const entries = registry.readAllRegistryEntries("proj-badjson");
		assert.equal(entries.length, 1);
		assert.equal(entries[0].name, "good");
	});

	test("skips entries without session_id", () => {
		seedProject("proj-nosid", []);
		const dir = join(tmpDir, "projects", "proj-nosid", "agents");
		writeFileSync(join(dir, "no-session.json"), JSON.stringify({ name: "ghost", pid: 99 }));
		writeFileSync(join(dir, "has-session.json"), JSON.stringify(makeEntry({ name: "ok", session_id: "sid_ok" })));
		const entries = registry.readAllRegistryEntries("proj-nosid");
		assert.equal(entries.length, 1);
		assert.equal(entries[0].name, "ok");
	});
});

// ── readAllRegistryEntriesAcrossProjects ────────────────────────────────────

describe("readAllRegistryEntriesAcrossProjects", () => {
	test("returns [] when no projects exist", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		assert.deepEqual(registry.readAllRegistryEntriesAcrossProjects(), []);
	});

	test("reads from multiple projects", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("p1", [makeEntry({ name: "a", session_id: "sa" })]);
		seedProject("p2", [makeEntry({ name: "b", session_id: "sb" })]);
		const entries = registry.readAllRegistryEntriesAcrossProjects();
		const names = entries.map((e) => e.name).sort();
		assert.equal(entries.length, 2);
		assert.deepEqual(names, ["a", "b"]);
	});
});

// ── removeRegistryEntry ─────────────────────────────────────────────────────

describe("removeRegistryEntry", () => {
	test("removes existing entry file", () => {
		seedProject("proj-rm", [makeEntry({ name: "to-delete", session_id: "rd1" })]);
		const filePath = join(tmpDir, "projects", "proj-rm", "agents", "to-delete.json");
		assert.ok(existsSync(filePath));
		registry.removeRegistryEntry("proj-rm", "to-delete");
		assert.ok(!existsSync(filePath));
	});

	test("does not throw for non-existent entry", () => {
		assert.doesNotThrow(() => registry.removeRegistryEntry("proj-rm", "ghost"));
	});
});

// ── pruneDeadEntries ────────────────────────────────────────────────────────

describe("pruneDeadEntries", () => {
	test("keeps entries with live PIDs", () => {
		seedProject("proj-live", [makeEntry({ name: "alive", session_id: "sl", pid: process.pid })]);
		const live = registry.pruneDeadEntries("proj-live");
		assert.equal(live.length, 1);
		assert.equal(live[0].name, "alive");
	});

	test("removes entries with dead PIDs and returns only live", () => {
		const deadPid = 999999;
		seedProject("proj-mixed", [
			makeEntry({ name: "zombie", session_id: "sz", pid: deadPid }),
			makeEntry({ name: "survivor", session_id: "ss", pid: process.pid }),
		]);
		const live = registry.pruneDeadEntries("proj-mixed");
		const names = live.map((e) => e.name).sort();
		assert.deepEqual(names, ["survivor"]);
	});

	test("removes dead entry files from disk", () => {
		const deadPid = 999998;
		const filePath = join(tmpDir, "projects", "proj-rmdead", "agents", "zombie.json");
		seedProject("proj-rmdead", [makeEntry({ name: "zombie", session_id: "sz2", pid: deadPid })]);
		assert.ok(existsSync(filePath));
		registry.pruneDeadEntries("proj-rmdead");
		assert.ok(!existsSync(filePath));
	});
});

// ── resolveUniqueName ───────────────────────────────────────────────────────

describe("resolveUniqueName", () => {
	test("returns desired name when no conflict", () => {
		seedProject("proj-unique", []);
		assert.equal(registry.resolveUniqueName("proj-unique", "scout"), "scout");
	});

	test("appends 2 when name is taken by live entry", () => {
		seedProject("proj-dup", [makeEntry({ name: "worker", session_id: "ss", pid: process.pid })]);
		assert.equal(registry.resolveUniqueName("proj-dup", "worker"), "worker2");
	});

	test("increments until unique name found", () => {
		seedProject("proj-incr", [
			makeEntry({ name: "bot", session_id: "sb1", pid: process.pid }),
			makeEntry({ name: "bot2", session_id: "sb2", pid: process.pid }),
			makeEntry({ name: "bot3", session_id: "sb3", pid: process.pid }),
		]);
		assert.equal(registry.resolveUniqueName("proj-incr", "bot"), "bot4");
	});

	test("ignores dead entries when checking uniqueness", () => {
		const deadPid = 999997;
		seedProject("proj-deadname", [makeEntry({ name: "ghost", session_id: "sg", pid: deadPid })]);
		assert.equal(registry.resolveUniqueName("proj-deadname", "ghost"), "ghost");
	});
});

// ── pruneDeadEntriesAllProjects ─────────────────────────────────────────────

describe("pruneDeadEntriesAllProjects", () => {
	test("prunes dead entries across all projects", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		const deadPid = 999996;
		seedProject("ap1", [
			makeEntry({ name: "a-live", session_id: "sa1", pid: process.pid }),
			makeEntry({ name: "a-dead", session_id: "sd1", pid: deadPid }),
		]);
		seedProject("ap2", [
			makeEntry({ name: "b-live", session_id: "sa2", pid: process.pid }),
			makeEntry({ name: "b-dead", session_id: "sd2", pid: deadPid }),
		]);
		const live = registry.pruneDeadEntriesAllProjects();
		const names = live.map((e) => e.name).sort();
		assert.deepEqual(names, ["a-live", "b-live"]);
	});

	test("returns [] when no projects root exists", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		assert.deepEqual(registry.pruneDeadEntriesAllProjects(), []);
	});
});

// ── listProjects ────────────────────────────────────────────────────────────

describe("listProjects", () => {
	test("lists project directories", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("alpha", [makeEntry({ name: "a", session_id: "sa" })]);
		seedProject("beta", [makeEntry({ name: "b", session_id: "sb" })]);
		const projects = registry.listProjects().sort();
		assert.deepEqual(projects, ["alpha", "beta"]);
	});

	test("returns [] when projects root is missing", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		assert.deepEqual(registry.listProjects(), []);
	});

	test("excludes non-directory files in projects root", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		mkdirSync(root, { recursive: true });
		seedProject("dir-proj", [makeEntry({ name: "d", session_id: "sd" })]);
		writeFileSync(join(root, "readme.txt"), "hello");
		const projects = registry.listProjects();
		assert.ok(projects.includes("dir-proj"));
		assert.ok(!projects.includes("readme.txt"));
	});
});

// ── resolveTarget ───────────────────────────────────────────────────────────

describe("resolveTarget", () => {
	test("finds by name within same project", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("rt-local", [makeEntry({ name: "helper", session_id: "sl", pid: process.pid })]);
		const entry = registry.resolveTarget("helper", { project: "rt-local" });
		assert.ok(entry);
		assert.equal(entry.name, "helper");
	});

	test("finds by session_id across projects", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("rt-other", [makeEntry({ name: "other", session_id: "target-sid", pid: process.pid })]);
		const entry = registry.resolveTarget("target-sid", { project: "rt-local" });
		assert.ok(entry);
		assert.equal(entry.name, "other");
	});

	test("finds by name across projects after local miss", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("rt-p1", [makeEntry({ name: "only-me", session_id: "sl1", pid: process.pid })]);
		seedProject("rt-p2", [makeEntry({ name: "global", session_id: "sg", pid: process.pid })]);
		const entry = registry.resolveTarget("global", { project: "rt-p1" });
		assert.ok(entry);
		assert.equal(entry.name, "global");
	});

	test("prefers local name match over cross-project", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("rt-local-pref", [makeEntry({ name: "shared", session_id: "local-sid", pid: process.pid })]);
		seedProject("rt-other-pref", [makeEntry({ name: "shared", session_id: "other-sid", pid: process.pid })]);
		const entry = registry.resolveTarget("shared", { project: "rt-local-pref" });
		assert.equal(entry.session_id, "local-sid");
	});

	test("returns null when no match found", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		seedProject("rt-empty", []);
		assert.equal(registry.resolveTarget("nobody", { project: "rt-empty" }), null);
	});

	test("returns null with null identity and no match", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		assert.equal(registry.resolveTarget("nobody", null), null);
	});

	test("skips dead entries", () => {
		const root = join(tmpDir, "projects");
		try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
		const deadPid = 999995;
		seedProject("rt-dead", [makeEntry({ name: "ghost", session_id: "ses_ghost", pid: deadPid })]);
		assert.equal(registry.resolveTarget("ghost", { project: "rt-dead" }), null);
	});
});
