import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let layoutWorkflowGrid;
let installRawWorkflowGrid;

test("setup: import workflowGrid", async () => {
	const mod = await import(join(repoRoot, "extensions", "lib", "workflowGrid.ts"));
	layoutWorkflowGrid = mod.layoutWorkflowGrid;
	installRawWorkflowGrid = mod.installRawWorkflowGrid;
});

// ── layoutWorkflowGrid ──────────────────────────────────────────────

test("empty items without emptyLine returns [\"\"]", () => {
	const result = layoutWorkflowGrid({
		items: [],
		cols: 3,
		width: 80,
		theme: {},
		renderCard: () => { throw new Error("should not be called"); },
	});
	assert.deepEqual(result, [""]);
});

test("empty items with emptyLine returns [\"\", emptyLine(theme)]", () => {
	const emptyLine = (theme) => `[empty ${theme.label}]`;
	const result = layoutWorkflowGrid({
		items: [],
		cols: 3,
		width: 80,
		theme: { label: "T" },
		renderCard: () => { throw new Error("should not be called"); },
		emptyLine,
	});
	assert.deepEqual(result, ["", "[empty T]"]);
});

test("single item in a single column", () => {
	const renderCard = (item, colWidth) => [
		`name: ${item.name}`.padEnd(colWidth),
		`desc: ${item.desc}`.padEnd(colWidth),
	];
	const result = layoutWorkflowGrid({
		items: [{ name: "foo", desc: "bar" }],
		cols: 1,
		width: 40,
		gap: 1,
		theme: {},
		renderCard,
	});
	// First element is always "", then card lines follow
	assert.equal(result[0], "");
	assert.equal(result.length, 3); // "" + 2 card lines
	assert.ok(result[1].includes("name: foo"));
	assert.ok(result[2].includes("desc: bar"));
});

test("two items in two columns", () => {
	const renderCard = (item, colWidth) => [
		`${item}`.padEnd(colWidth),
	];
	const result = layoutWorkflowGrid({
		items: ["A", "B"],
		cols: 2,
		width: 30,
		gap: 1,
		theme: {},
		renderCard,
	});
	assert.equal(result.length, 2); // "" + 1 line with both cards joined
	const dataLine = result[1];
	assert.ok(dataLine.includes("A"));
	assert.ok(dataLine.includes("B"));
});

test("cols is clamped to items.length when cols > items", () => {
	const renderCard = (item, colWidth) => [`${item}`.padEnd(colWidth)];
	const result = layoutWorkflowGrid({
		items: ["X"],
		cols: 5,
		width: 50,
		gap: 1,
		theme: {},
		renderCard,
	});
	// Only 1 column used despite cols=5
	assert.equal(result.length, 2); // "" + 1 data line
	assert.ok(result[1].includes("X"));
});

test("items not filling last row are padded with empty strings", () => {
	const renderCard = (item, colWidth) => [`${item}`.padEnd(colWidth)];
	const result = layoutWorkflowGrid({
		items: ["A", "B", "C"],
		cols: 2,
		width: 30,
		gap: 1,
		theme: {},
		renderCard,
	});
	// Row 1: A + B, Row 2: C + padding
	assert.equal(result.length, 3); // "" + 2 data lines
	// Second data line should have "C" and some spaces (padding)
	assert.ok(result[2].includes("C"));
});

test("gap parameter affects spacing between columns", () => {
	const renderCard = (item, colWidth) => [`${item}`.padEnd(colWidth)];
	const gap0 = layoutWorkflowGrid({
		items: ["A", "B"],
		cols: 2,
		width: 30,
		gap: 0,
		theme: {},
		renderCard,
	});
	const gap3 = layoutWorkflowGrid({
		items: ["A", "B"],
		cols: 2,
		width: 30,
		gap: 3,
		theme: {},
		renderCard,
	});
	const line0 = gap0[1];
	const line3 = gap3[1];
	// Different gap values produce different output lines
	assert.notEqual(line0, line3, "different gap values should produce different output");
	// With gap=0, colWidth is wider (more space for card content)
	// With gap=3, colWidth is narrower (gap eats into width)
	// Verify that B's position differs due to gap
	const bIdx0 = line0.indexOf("B");
	const bIdx3 = line3.indexOf("B");
	assert.ok(bIdx0 !== bIdx3, "gap value should shift column positions");
});

test("renderCard receives correct colWidth and theme", () => {
	const calls = [];
	const renderCard = (item, colWidth, theme) => {
		calls.push({ item, colWidth, theme });
		return [`${item}`.padEnd(colWidth)];
	};
	const theme = { mode: "dark" };
	layoutWorkflowGrid({
		items: ["A"],
		cols: 1,
		width: 40,
		gap: 1,
		theme,
		renderCard,
	});
	assert.equal(calls.length, 1);
	assert.equal(calls[0].item, "A");
	assert.equal(calls[0].theme, theme);
	assert.equal(typeof calls[0].colWidth, "number");
	assert.ok(calls[0].colWidth > 0, "colWidth should be positive");
});

test("colWidth decreases when more columns are added", () => {
	const widths = [];
	const renderCard = (item, colWidth) => {
		widths.push(colWidth);
		return [`${item}`.padEnd(colWidth)];
	};
	layoutWorkflowGrid({
		items: ["A"],
		cols: 1,
		width: 100,
		gap: 1,
		theme: {},
		renderCard,
	});
	const singleColWidth = widths[0];
	widths.length = 0;
	layoutWorkflowGrid({
		items: ["A", "B"],
		cols: 2,
		width: 100,
		gap: 1,
		theme: {},
		renderCard,
	});
	const multiColWidth = widths[0];
	assert.ok(singleColWidth > multiColWidth, "single column should be wider than multi-column");
});

test("all cards in a row have the same height", () => {
	const renderCard = (item, colWidth) => {
		const lines = [];
		const lineCount = item === "tall" ? 4 : 2;
		for (let i = 0; i < lineCount; i++) {
			lines.push(`${item}-${i}`.padEnd(colWidth));
		}
		return lines;
	};
	const result = layoutWorkflowGrid({
		items: ["tall", "short"],
		cols: 2,
		width: 40,
		gap: 1,
		theme: {},
		renderCard,
	});
	// Both cards should have same height (max of both)
	// Result: "" + 4 lines (max card height)
	assert.equal(result.length, 5);
});

// ── installRawWorkflowGrid ──────────────────────────────────────────

test("installRawWorkflowGrid no-ops when getUi returns null", () => {
	let setWidgetCalled = false;
	const result = installRawWorkflowGrid({
		widgetKey: "test-widget",
		getUi: () => null,
		getItems: () => [],
		getCols: () => 2,
		renderCard: () => [""],
		emptyLine: () => "",
	});
	assert.equal(result, undefined);
	assert.equal(setWidgetCalled, false);
});

test("installRawWorkflowGrid registers widget when getUi returns valid UI", () => {
	let registeredKey = null;
	let registeredFactory = null;
	installRawWorkflowGrid({
		widgetKey: "my-widget",
		getUi: () => ({
			setWidget: (key, factory) => {
				registeredKey = key;
				registeredFactory = factory;
			},
		}),
		getItems: () => ["A", "B"],
		getCols: () => 2,
		renderCard: (item, colWidth) => [`${item}`.padEnd(colWidth)],
		emptyLine: () => "--",
	});
	assert.equal(registeredKey, "my-widget");
	assert.equal(typeof registeredFactory, "function");
});

test("installed widget render delegates to layoutWorkflowGrid", () => {
	let capturedWidget;
	const fakeUI = {
		setWidget: (_key, factory) => {
			capturedWidget = factory(null, { theme: true });
		},
	};
	installRawWorkflowGrid({
		widgetKey: "test",
		getUi: () => fakeUI,
		getItems: () => ["X"],
		getCols: () => 1,
		renderCard: (item, colWidth) => [`${item}`.padEnd(colWidth)],
		emptyLine: () => "",
	});
	assert.ok(capturedWidget, "widget should have been captured");
	assert.equal(typeof capturedWidget.render, "function");
	const lines = capturedWidget.render(60);
	assert.ok(Array.isArray(lines));
	assert.ok(lines.length >= 2, "should return at least '' + 1 data line");
});
