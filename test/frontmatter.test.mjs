import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let frontmatter;

before(async () => {
	frontmatter = await import(join(repoRoot, "extensions", "lib", "frontmatter.ts"));
});

// ── parseMarkdownFrontmatter ─────────────────────────────────────────────────

describe("parseMarkdownFrontmatter", () => {
	test("extracts fields and body from valid frontmatter", () => {
		const raw = "---\nname: test-expert\ndescription: A test\ntools: read\n---\n\nBody here.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.equal(result.fields.name, "test-expert");
		assert.equal(result.fields.description, "A test");
		assert.equal(result.fields.tools, "read");
		assert.equal(result.body, "Body here.");
	});

	test("returns raw content when no frontmatter", () => {
		const raw = "Just some markdown content.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.deepEqual(result.fields, {});
		assert.deepEqual(result.skills, []);
		assert.equal(result.body, "Just some markdown content.");
	});

	test("extracts skills from frontmatter", () => {
		const raw = "---\nname: test\nskills:\n  - skill1\n  - skill2\n---\n\nBody.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.equal(result.fields.name, "test");
		assert.deepEqual(result.skills, ["skill1", "skill2"]);
		assert.equal(result.body, "Body.");
	});

	test("handles quoted values", () => {
		const raw = '---\nname: "test expert"\ndescription: \'A test\'\n---\n\nBody.';
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.equal(result.fields.name, "test expert");
		assert.equal(result.fields.description, "A test");
	});

	test("handles empty frontmatter block (returns raw when separator has no newline prefix)", () => {
		const raw = "---\n---\n\nBody.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		// The regex requires \n---\n but --- follows immediately without \n prefix
		// So regex doesn't match, raw content is returned
		assert.equal(result.body, raw);
	});

	test("handles missing body (frontmatter only, no newline after closing ---)", () => {
		const raw = "---\nname: test\n---";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		// When there's no newline after closing ---, the regex doesn't match
		// so it returns the raw content
		assert.equal(result.body, raw);
	});

	test("handles multiple fields with same key (last wins)", () => {
		const raw = "---\nname: first\nname: second\n---\n\nBody.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.equal(result.fields.name, "second");
	});

	test("handles skills mixed with fields", () => {
		const raw = "---\nname: test\nskills:\n  - skill1\n  - skill2\ntools: read\n---\n\nBody.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.equal(result.fields.name, "test");
		assert.equal(result.fields.tools, "read");
		assert.deepEqual(result.skills, ["skill1", "skill2"]);
	});

	test("handles indented skill items", () => {
		const raw = "---\nname: test\n  - skill1\n  - skill2\n---\n\nBody.";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		assert.deepEqual(result.skills, ["skill1", "skill2"]);
	});

	test("returns raw content when frontmatter has no trailing newline", () => {
		const raw = "---\nname: test\n---";
		const result = frontmatter.parseMarkdownFrontmatter(raw);
		// Without trailing newline after ---, regex doesn't match
		assert.equal(result.body, raw);
	});
});
