/**
 * coms — Peer-to-peer messaging between Pi agents on the same machine
 *
 * Each agent listens on a single endpoint (unix socket on POSIX, named pipe on
 * Windows) and discovers peers through per-project registry files under
 * ~/.pi/coms/projects/<project>/agents/<name>.json.
 *
 * Session lifecycle (boot, keepalive, response capture, shutdown) lives in
 * coms/session.ts. This module wires those into the Pi extension API and
 * registers the /coms command.
 *
 * Usage: pi -e extensions/coms.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyExtensionDefaults } from "../themeMap.ts";
import type { InboundContext, PendingReply, PeerCard } from "./types.ts";
import { ComsRuntime } from "./runtime.ts";
import { registerComsTools } from "./tools.ts";
import { createRenderPool } from "./widget.ts";
import {
	createSessionState,
	bootSession,
	handleAgentEnd,
	cleanShutdown,
} from "./session.ts";

export default function (pi: ExtensionAPI) {
	pi.registerFlag("name", { description: "Override agent name", type: "string", default: undefined });
	pi.registerFlag("purpose", { description: "Override agent purpose", type: "string", default: undefined });
	pi.registerFlag("project", { description: "Project namespace for peer discovery", type: "string", default: "default" });
	pi.registerFlag("color", { description: "Hex color #RRGGBB", type: "string", default: undefined });
	pi.registerFlag("explicit", { description: "Hide from auto-discovery", type: "boolean", default: false });

	const state = createSessionState();
	const peerCards = new Map<string, PeerCard>();
	const pendingReplies = new Map<string, PendingReply>();
	const inboundQueue = new Map<string, InboundContext>();

	const poolDeps = {
		getIdentity: () => state.identity,
		getDisplayProject: () => state.displayProject,
		getIncludeExplicit: () => state.includeExplicit,
		peerCards,
	};
	const renderPool = createRenderPool(poolDeps);

	const comsRuntime = new ComsRuntime({
		pi,
		getIdentity: () => state.identity,
		setCurrentInbound: (ctx) => { state.currentInbound = ctx; },
		getCurrentCtx: () => state.currentCtx,
		inboundQueue,
		pendingReplies,
		peerCards,
		getDisplayProject: () => state.displayProject,
		getIncludeExplicit: () => state.includeExplicit,
		renderPool,
	});

	registerComsTools(pi, {
		getIdentity: () => state.identity,
		getCurrentInbound: () => state.currentInbound,
		pendingReplies,
		pingPeer: (endpoint: string) => comsRuntime.pingPeer(endpoint),
	});

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		await bootSession(pi, state, ctx, comsRuntime, renderPool, inboundQueue);
	});

	pi.on("agent_end", async (_event, ctx) => {
		await handleAgentEnd(pi, state, inboundQueue, ctx);
	});

	pi.registerCommand("coms", {
		description: "Force-refresh the coms pool widget (or filter with --all / --project <name>)",
		handler: async (args, ctx) => {
			const trimmed = (args ?? "").trim();
			if (trimmed.includes("--all")) {
				state.includeExplicit = !state.includeExplicit;
				try { ctx.ui.notify(`coms: include_explicit = ${state.includeExplicit}`, "info"); } catch { /* ignore */ }
			}
			const projectMatch = trimmed.match(/--project\s+(\S+)/);
			if (projectMatch) {
				state.displayProject = projectMatch[1];
				try { ctx.ui.notify(`coms: displaying project ${state.displayProject}`, "info"); } catch { /* ignore */ }
			}
			await comsRuntime.refreshPool();
		},
	});

	pi.on("session_shutdown", async () => {
		await cleanShutdown(pi, state, inboundQueue, pendingReplies);
	});
	process.on("SIGINT", () => { void cleanShutdown(pi, state, inboundQueue, pendingReplies); });
	process.on("SIGTERM", () => { void cleanShutdown(pi, state, inboundQueue, pendingReplies); });
}
