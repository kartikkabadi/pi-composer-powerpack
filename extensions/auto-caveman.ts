import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";

const CAVEMAN_SKILL_PATH =
	"/Users/user/.pi/agent/vendor-skills/mattpocock-skills/skills/productivity/caveman/SKILL.md";

export default function autoCaveman(pi: ExtensionAPI) {
	// Default ON so every new session starts in caveman mode
	let cavemanMode = true;

	// Reset to ON whenever a session starts (new, resume, fork, reload)
	pi.on("session_start", () => {
		cavemanMode = true;
	});

	// /caveman toggles it for the current session
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

	// Inject caveman instructions into the system prompt every turn while active
	pi.on("before_agent_start", async (event) => {
		if (!cavemanMode) return;

		let skillText: string;
		try {
			const raw = fs.readFileSync(CAVEMAN_SKILL_PATH, "utf-8");
			// Strip YAML frontmatter, keep only the instructions
			skillText = raw.replace(/^---[\s\S]*?---\n*/, "").trim();
		} catch {
			skillText =
				"Respond terse like smart caveman. Drop articles, filler, pleasantries. Fragments OK. Abbreviate common terms. Technical terms stay exact.";
		}

		return {
			systemPrompt:
				event.systemPrompt + "\n\n## Caveman Mode\n" + skillText,
		};
	});
}
