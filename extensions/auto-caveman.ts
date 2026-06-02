import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { applyExtensionDefaults } from "./themeMap.ts";
import { parseMarkdownFrontmatter } from "./lib/frontmatter.ts";

const CAVEMAN_SKILL_PATH =
	process.env.PI_CAVEMAN_SKILL_PATH ||
	join(homedir(), ".pi", "agent", "vendor-skills", "mattpocock-skills", "skills", "productivity", "caveman", "SKILL.md");

const FALLBACK_INSTRUCTIONS =
	"Respond terse like smart caveman. Drop articles, filler, pleasantries. Fragments OK. Abbreviate common terms. Technical terms stay exact.";

/**
 * Auto-Caveman extension.
 * Automatically injects caveman-mode instructions into the agent's system
 * prompt on session start. Reads instructions from a SKILL.md file or falls
 * back to a built-in terse-response directive. Supports /caveman toggle.
 */
export default function autoCaveman(pi: ExtensionAPI) {
	let cavemanMode = true;

	pi.on("session_start", (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		cavemanMode = true;
	});

	pi.registerCommand("caveman", {
		description: "Toggle caveman mode for this session",
		handler: async (_args, ctx) => {
			cavemanMode = !cavemanMode;
			ctx.ui.notify(
				cavemanMode ? "Caveman mode ON" : "Caveman mode OFF",
				"info",
			);
		},
	});

	pi.on("before_agent_start", async (event) => {
		if (!cavemanMode) return;

		let skillText: string;
		try {
			const raw = fs.readFileSync(CAVEMAN_SKILL_PATH, "utf-8");
			const { body } = parseMarkdownFrontmatter(raw);
			skillText = body || FALLBACK_INSTRUCTIONS;
		} catch {
			skillText = FALLBACK_INSTRUCTIONS;
		}

		return {
			systemPrompt:
				event.systemPrompt + "\n\n## Caveman Mode\n" + skillText,
		};
	});
}
