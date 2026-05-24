export type ParsedFrontmatter = {
	fields: Record<string, string>;
	skills: string[];
	body: string;
};

export function parseMarkdownFrontmatter(raw: string): ParsedFrontmatter {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) {
		return { fields: {}, skills: [], body: raw };
	}

	const fields: Record<string, string> = {};
	const skills: string[] = [];
	for (const line of match[1].split("\n")) {
		const skillItem = line.match(/^\s+-\s+(.+)$/);
		if (skillItem) {
			skills.push(skillItem[1].trim());
			continue;
		}
		const idx = line.indexOf(":");
		if (idx > 0) {
			let val = line.slice(idx + 1).trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			fields[line.slice(0, idx).trim()] = val;
		}
	}

	return { fields, skills, body: match[2].trim() };
}
