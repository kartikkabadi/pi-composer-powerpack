/** A single card in the workflow grid, represented as an array of lines */
export type WorkflowGridCard = string[];

/**
 * Layout items in a grid with specified columns and width.
 *
 * Creates a responsive grid layout for displaying agent cards,
 * status cards, or other workflow items.
 *
 * @param options - Layout configuration
 * @param options.items - Items to display in the grid
 * @param options.cols - Number of columns
 * @param options.width - Total available width
 * @param options.gap - Gap between columns (default: 1)
 * @param options.theme - Theme object for styling
 * @param options.renderCard - Function to render an item as a card
 * @param options.emptyLine - Function to render an empty line
 * @returns Array of formatted strings for the grid
 */
export function layoutWorkflowGrid<T>(options: {
	items: T[];
	cols: number;
	width: number;
	gap?: number;
	theme: unknown;
	renderCard: (item: T, colWidth: number, theme: unknown) => WorkflowGridCard;
	emptyLine?: (theme: unknown) => string;
}): string[] {
	const { items, cols, width, gap = 1, theme, renderCard, emptyLine } = options;
	if (items.length === 0) {
		return emptyLine ? ["", emptyLine(theme)] : [""];
	}

	const colCount = Math.min(cols, items.length);
	const colWidth = Math.floor((width - gap * (colCount - 1)) / colCount) - 1;
	const lines: string[] = [""];

	for (let i = 0; i < items.length; i += colCount) {
		const rowItems = items.slice(i, i + colCount);
		const cards = rowItems.map((item) => renderCard(item, colWidth, theme));

		while (cards.length < colCount) {
			cards.push(Array(cards[0]?.length ?? 6).fill(" ".repeat(colWidth)));
		}

		const cardHeight = cards[0].length;
		for (let line = 0; line < cardHeight; line++) {
			lines.push(cards.map((card) => card[line] || "").join(" ".repeat(gap)));
		}
	}

	return lines;
}

/**
 * Install a workflow grid widget in the extension UI.
 *
 * Creates a widget that renders a dynamic grid of items, updating
 * whenever the items or columns change.
 *
 * @param options - Widget configuration
 * @param options.widgetKey - Unique key for the widget
 * @param options.getUi - Function to get the UI context
 * @param options.getItems - Function to get current items
 * @param options.getCols - Function to get current column count
 * @param options.renderCard - Function to render an item as a card
 * @param options.emptyLine - Function to render an empty line
 */
export function installRawWorkflowGrid<T>(options: {
	widgetKey: string;
	getUi: () => { setWidget: (key: string, factory: (tui: unknown, theme: unknown) => unknown) => void } | null;
	getItems: () => T[];
	getCols: () => number;
	renderCard: (item: T, colWidth: number, theme: unknown) => WorkflowGridCard;
	emptyLine: (theme: unknown) => string;
}): void {
	const ui = options.getUi();
	if (!ui) return;

	ui.setWidget(options.widgetKey, (_tui, theme) => ({
		render(width: number): string[] {
			return layoutWorkflowGrid({
				items: options.getItems(),
				cols: options.getCols(),
				width,
				theme,
				renderCard: options.renderCard,
				emptyLine: options.emptyLine,
			});
		},
		invalidate() {},
	}));
}
