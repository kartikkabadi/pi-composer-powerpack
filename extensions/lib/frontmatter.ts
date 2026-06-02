/** Parsed frontmatter from a markdown file */
export type ParsedFrontmatter = {
	fields: Record<string, string>;
	skills: string[];
	body: string;
};

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * Extracts fields from the YAML frontmatter block and the markdown body.
 * Supports both single-line fields (key: value) and multi-line skills
 * (items starting with "- ").
 *
 * @param raw - Raw markdown string with YAML frontmatter
 * @returns Parsed frontmatter with fields, skills, and body
 *
 * @example
 * ```ts
 * const raw = `---
 * name: test-expert
 * description: A test
 * skills:
 *   - skill1
 *   - skill2
 * ---
 *
 * Body here.
 * `;
 * const { fields, skills, body } = parseMarkdownFrontmatter(raw);
 * // fields.name === "test-expert"
 * // skills === ["skill1", "skill2"]
 * // body === "Body here."
 * ```
 */
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
