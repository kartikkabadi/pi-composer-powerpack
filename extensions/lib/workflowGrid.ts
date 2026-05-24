export type WorkflowGridCard = string[];

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
