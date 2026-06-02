import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadWorkflowKit() {
	return import(join(repoRoot, "extensions", "lib", "workflowKit.ts"));
}

// ── Constants ───────────────────────────────────────────────────────────────

describe("workflowKit constants", () => {
	test("TRUNCATE_OUTPUT is 8000", async () => {
		const { TRUNCATE_OUTPUT } = await loadWorkflowKit();
		assert.equal(TRUNCATE_OUTPUT, 8000);
	});

	test("TRUNCATE_EXPANDED is 4000", async () => {
		const { TRUNCATE_EXPANDED } = await loadWorkflowKit();
		assert.equal(TRUNCATE_EXPANDED, 4000);
	});

	test("TRUNCATE_WORK is 50", async () => {
		const { TRUNCATE_WORK } = await loadWorkflowKit();
		assert.equal(TRUNCATE_WORK, 50);
	});
});

// ── statusColor ─────────────────────────────────────────────────────────────

describe("statusColor", () => {
	test("returns 'dim' for idle", async () => {
		const { statusColor } = await loadWorkflowKit();
		assert.equal(statusColor("idle"), "dim");
	});

	test("returns 'dim' for pending", async () => {
		const { statusColor } = await loadWorkflowKit();
		assert.equal(statusColor("pending"), "dim");
	});

	test("returns 'accent' for running", async () => {
		const { statusColor } = await loadWorkflowKit();
		assert.equal(statusColor("running"), "accent");
	});

	test("returns 'accent' for researching", async () => {
		const { statusColor } = await loadWorkflowKit();
		assert.equal(statusColor("researching"), "accent");
	});

	test("returns 'success' for done", async () => {
		const { statusColor } = await loadWorkflowKit();
		assert.equal(statusColor("done"), "success");
	});

	test("returns 'error' for error", async () => {
		const { statusColor } = await loadWorkflowKit();
		assert.equal(statusColor("error"), "error");
	});
});

// ── statusIcon ──────────────────────────────────────────────────────────────

describe("statusIcon", () => {
	test("returns '○' for idle", async () => {
		const { statusIcon } = await loadWorkflowKit();
		assert.equal(statusIcon("idle"), "○");
	});

	test("returns '○' for pending", async () => {
		const { statusIcon } = await loadWorkflowKit();
		assert.equal(statusIcon("pending"), "○");
	});

	test("returns '●' for running", async () => {
		const { statusIcon } = await loadWorkflowKit();
		assert.equal(statusIcon("running"), "●");
	});

	test("returns '◉' for researching", async () => {
		const { statusIcon } = await loadWorkflowKit();
		assert.equal(statusIcon("researching"), "◉");
	});

	test("returns '✓' for done", async () => {
		const { statusIcon } = await loadWorkflowKit();
		assert.equal(statusIcon("done"), "✓");
	});

	test("returns '✗' for error", async () => {
		const { statusIcon } = await loadWorkflowKit();
		assert.equal(statusIcon("error"), "✗");
	});
});

// ── truncateText ────────────────────────────────────────────────────────────

describe("truncateText", () => {
	test("returns original string when under max", async () => {
		const { truncateText } = await loadWorkflowKit();
		assert.equal(truncateText("hello", 10), "hello");
	});

	test("returns original string when exactly at max", async () => {
		const { truncateText } = await loadWorkflowKit();
		assert.equal(truncateText("hello", 5), "hello");
	});

	test("truncates and appends '...' when over max", async () => {
		const { truncateText } = await loadWorkflowKit();
		const result = truncateText("hello world", 8);
		assert.equal(result, "hello...");
		assert.equal(result.length, 8);
	});

	test("handles empty string", async () => {
		const { truncateText } = await loadWorkflowKit();
		assert.equal(truncateText("", 10), "");
	});

	test("handles max equal to ellipsis length", async () => {
		const { truncateText } = await loadWorkflowKit();
		const result = truncateText("hello", 3);
		assert.equal(result, "...");
	});
});

// ── truncateOutput ──────────────────────────────────────────────────────────

describe("truncateOutput", () => {
	test("returns original when under default limit", async () => {
		const { truncateOutput } = await loadWorkflowKit();
		const short = "a".repeat(100);
		assert.equal(truncateOutput(short), short);
	});

	test("truncates and appends marker when over default limit", async () => {
		const { truncateOutput, TRUNCATE_OUTPUT } = await loadWorkflowKit();
		const long = "a".repeat(TRUNCATE_OUTPUT + 100);
		const result = truncateOutput(long);
		assert.ok(result.length < long.length);
		assert.match(result, /\n\n\.\.\. \[truncated\]/);
		assert.equal(result.length, TRUNCATE_OUTPUT + "\n\n... [truncated]".length);
	});

	test("respects custom limit", async () => {
		const { truncateOutput } = await loadWorkflowKit();
		const input = "a".repeat(200);
		const result = truncateOutput(input, 50);
		assert.equal(result.length, 50 + "\n\n... [truncated]".length);
		assert.match(result, /\[truncated\]/);
	});

	test("returns original when exactly at limit", async () => {
		const { truncateOutput } = await loadWorkflowKit();
		const input = "a".repeat(100);
		const result = truncateOutput(input, 100);
		assert.equal(result, input);
	});

	test("handles empty string", async () => {
		const { truncateOutput } = await loadWorkflowKit();
		assert.equal(truncateOutput(""), "");
	});
});

// ── lastNonEmptyLine ────────────────────────────────────────────────────────

describe("lastNonEmptyLine", () => {
	test("returns the only line when single line", async () => {
		const { lastNonEmptyLine } = await loadWorkflowKit();
		assert.equal(lastNonEmptyLine("hello"), "hello");
	});

	test("returns last non-empty line with trailing newlines", async () => {
		const { lastNonEmptyLine } = await loadWorkflowKit();
		assert.equal(lastNonEmptyLine("line1\nline2\n\n\n"), "line2");
	});

	test("returns last non-empty line with trailing whitespace-only lines", async () => {
		const { lastNonEmptyLine } = await loadWorkflowKit();
		assert.equal(lastNonEmptyLine("first\nsecond\n  \n  "), "second");
	});

	test("returns empty string for all-empty input", async () => {
		const { lastNonEmptyLine } = await loadWorkflowKit();
		assert.equal(lastNonEmptyLine("\n\n\n"), "");
	});

	test("returns empty string for empty input", async () => {
		const { lastNonEmptyLine } = await loadWorkflowKit();
		assert.equal(lastNonEmptyLine(""), "");
	});

	test("handles text with no newlines", async () => {
		const { lastNonEmptyLine } = await loadWorkflowKit();
		assert.equal(lastNonEmptyLine("single line of text"), "single line of text");
	});
});

// ── clearSessionFiles ───────────────────────────────────────────────────────

describe("clearSessionFiles", () => {
	test("deletes files matching prefix and .json extension", async () => {
		const { clearSessionFiles } = await loadWorkflowKit();
		const dir = mkdtempSync(join(tmpdir(), "wf-test-"));
		writeFileSync(join(dir, "session-abc.json"), "{}");
		writeFileSync(join(dir, "session-def.json"), "{}");
		writeFileSync(join(dir, "other-file.txt"), "keep me");

		clearSessionFiles(dir, "session-");
		const remaining = readdirSync(dir);
		assert.ok(!remaining.includes("session-abc.json"));
		assert.ok(!remaining.includes("session-def.json"));
		assert.ok(remaining.includes("other-file.txt"));

		rmSync(dir, { recursive: true });
	});

	test("does nothing when directory does not exist", async () => {
		const { clearSessionFiles } = await loadWorkflowKit();
		assert.doesNotThrow(() => {
			clearSessionFiles("/nonexistent/path/to/dir", "session-");
		});
	});

	test("does not delete files without matching prefix", async () => {
		const { clearSessionFiles } = await loadWorkflowKit();
		const dir = mkdtempSync(join(tmpdir(), "wf-test-"));
		writeFileSync(join(dir, "other-abc.json"), "{}");
		writeFileSync(join(dir, "session-abc.json"), "{}");

		clearSessionFiles(dir, "session-");
		const remaining = readdirSync(dir);
		assert.ok(remaining.includes("other-abc.json"));
		assert.ok(!remaining.includes("session-abc.json"));

		rmSync(dir, { recursive: true });
	});

	test("does not delete non-.json files with matching prefix", async () => {
		const { clearSessionFiles } = await loadWorkflowKit();
		const dir = mkdtempSync(join(tmpdir(), "wf-test-"));
		writeFileSync(join(dir, "session-abc.txt"), "not json");
		writeFileSync(join(dir, "session-abc.json"), "{}");

		clearSessionFiles(dir, "session-");
		const remaining = readdirSync(dir);
		assert.ok(remaining.includes("session-abc.txt"));
		assert.ok(!remaining.includes("session-abc.json"));

		rmSync(dir, { recursive: true });
	});

	test("handles empty directory", async () => {
		const { clearSessionFiles } = await loadWorkflowKit();
		const dir = mkdtempSync(join(tmpdir(), "wf-test-"));
		clearSessionFiles(dir, "session-");
		assert.deepEqual(readdirSync(dir), []);

		rmSync(dir, { recursive: true });
	});
});

// ── createModeToggle ────────────────────────────────────────────────────────

describe("createModeToggle", () => {
	test("starts inactive", async () => {
		const { createModeToggle } = await loadWorkflowKit();
		const toggle = createModeToggle(
			{ setActiveTools: () => {} },
			{
				statusKey: "test-mode",
				activeToolNames: ["tool-a"],
				allToolNames: () => ["tool-a", "tool-b"],
			},
		);
		assert.equal(toggle.active, false);
	});

	test("activate sets active to true", async () => {
		const { createModeToggle } = await loadWorkflowKit();
		const toggle = createModeToggle(
			{ setActiveTools: () => {} },
			{
				statusKey: "test-mode",
				activeToolNames: ["tool-a"],
				allToolNames: () => ["tool-a", "tool-b"],
			},
		);
		toggle.enable();
		assert.equal(toggle.active, true);
	});

	test("disable sets active to false and restores all tools", async () => {
		const { createModeToggle } = await loadWorkflowKit();
		let restoredTools = null;
		const mockPi = {
			setActiveTools: (tools) => { restoredTools = tools; },
		};
		const toggle = createModeToggle(mockPi, {
			statusKey: "test-mode",
			activeToolNames: ["tool-a"],
			allToolNames: () => ["tool-a", "tool-b", "tool-c"],
		});

		toggle.enable();
		assert.equal(toggle.active, true);

		toggle.disable();
		assert.equal(toggle.active, false);
		assert.deepEqual(restoredTools, ["tool-a", "tool-b", "tool-c"]);
	});

	test("disable with empty tool list does not call setActiveTools", async () => {
		const { createModeToggle } = await loadWorkflowKit();
		let called = false;
		const mockPi = {
			setActiveTools: () => { called = true; },
		};
		const toggle = createModeToggle(mockPi, {
			statusKey: "test-mode",
			activeToolNames: [],
			allToolNames: () => [],
		});

		toggle.disable();
		assert.equal(called, false);
	});

	test("multiple enable/disable cycles work correctly", async () => {
		const { createModeToggle } = await loadWorkflowKit();
		const toggle = createModeToggle(
			{ setActiveTools: () => {} },
			{
				statusKey: "test-mode",
				activeToolNames: ["tool-a"],
				allToolNames: () => ["tool-a", "tool-b"],
			},
		);

		for (let i = 0; i < 5; i++) {
			toggle.enable();
			assert.equal(toggle.active, true);
			toggle.disable();
			assert.equal(toggle.active, false);
		}
	});
});

// ── renderStatusCard ────────────────────────────────────────────────────────

describe("renderStatusCard", () => {
	const mockTheme = {
		fg: (_color, text) => text,
		bold: (text) => text,
	};

	test("renders a basic card with idle status", async () => {
		const { renderStatusCard } = await loadWorkflowKit();
		const lines = renderStatusCard({
			name: "TestTask",
			status: "idle",
			elapsed: 0,
			workText: "",
			theme: mockTheme,
			colWidth: 30,
		});
		assert.ok(Array.isArray(lines));
		assert.ok(lines.length >= 4); // top, name, status, work, bot
		assert.ok(lines[0].includes("┌"));
		assert.ok(lines[lines.length - 1].includes("└"));
	});

	test("renders with running status and elapsed time", async () => {
		const { renderStatusCard } = await loadWorkflowKit();
		const lines = renderStatusCard({
			name: "RunningTask",
			status: "running",
			elapsed: 5000,
			workText: "working...",
			theme: mockTheme,
			colWidth: 40,
		});
		const statusLine = lines.find((l) => l.includes("●"));
		assert.ok(statusLine, "should have a running icon line");
		assert.ok(statusLine.includes("5s"), "should show elapsed seconds");
	});

	test("renders with extraLines", async () => {
		const { renderStatusCard } = await loadWorkflowKit();
		const lines = renderStatusCard({
			name: "WithExtras",
			status: "done",
			elapsed: 1000,
			workText: "",
			theme: mockTheme,
			colWidth: 30,
			extraLines: [{ text: "extra info", visibleLen: 10 }],
		});
		const extraLine = lines.find((l) => l.includes("extra info"));
		assert.ok(extraLine, "should contain extra line text");
	});

	test("idle and pending status do not show elapsed time", async () => {
		const { renderStatusCard } = await loadWorkflowKit();
		const lines = renderStatusCard({
			name: "Pending",
			status: "pending",
			elapsed: 99999,
			workText: "",
			theme: mockTheme,
			colWidth: 30,
		});
		const statusLine = lines.find((l) => l.includes("○"));
		assert.ok(statusLine);
		assert.ok(!statusLine.includes("99s"), "should not show elapsed for pending");
	});
});
