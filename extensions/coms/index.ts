/**
 * coms — Peer-to-peer messaging between Pi agents on the same machine
 *
 * Each agent listens on a single endpoint (unix socket on POSIX, named pipe on
 * Windows) and discovers peers through per-project registry files under
 * ~/.pi/coms/projects/<project>/agents/<name>.json.
 *
 * Phase A (foundation): identity resolution, registry I/O, transport bind/send,
 * connection handlers. Phase B: tools (coms_list/send/get/await), agent_end
 * response capture. Phase C: live pool widget, ping + keepalive cycles, /coms
 * slash command, clean shutdown lifecycle.
 *
 * Usage: pi -e extensions/coms.ts
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyExtensionDefaults } from "../themeMap.ts";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	fallbackColor,
	isValidHex,
	makeEndpoint,
	nowIso,
	readCliFlags,
	readFrontmatterFromArgv,
	ulid,
} from "./protocol.ts";
import { ComsRuntime } from "./runtime.ts";
import {
	removeRegistryEntry,
	resolveUniqueName,
	writeRegistryAtomic,
} from "./registry.ts";
import { registerComsTools } from "./tools.ts";
import { bindEndpoint, sendEnvelope } from "./transport.ts";
import {
	COMS_DIR,
	KEEPALIVE_INTERVAL_MS,
	PING_INTERVAL_MS,
	type AgentCard,
	type ComsIdentity,
	type InboundContext,
	type PendingReply,
	type RegistryEntry,
	type ResponseEnvelope,
} from "./types.ts";
import { createRenderPool, installPoolWidget } from "./widget.ts";

export default function (pi: ExtensionAPI) {
	pi.registerFlag("name", {
		description: "Override agent name (otherwise from frontmatter or auto-generated)",
		type: "string",
		default: undefined,
	});
	pi.registerFlag("purpose", {
		description: "Override agent purpose (otherwise from frontmatter description)",
		type: "string",
		default: undefined,
	});
	pi.registerFlag("project", {
		description: "Project namespace for peer discovery",
		type: "string",
		default: "default",
	});
	pi.registerFlag("color", {
		description: "Hex color #RRGGBB (otherwise from frontmatter or palette fallback)",
		type: "string",
		default: undefined,
	});
	pi.registerFlag("explicit", {
		description: "Hide this agent from auto-discovery; only addressable by exact name",
		type: "boolean",
		default: false,
	});

	let identity: ComsIdentity | null = null;
	const peerCards = new Map<string, AgentCard & { staleCount: number }>();
	const pendingReplies = new Map<string, PendingReply>();
	const inboundQueue = new Map<string, InboundContext>();
	let server: net.Server | null = null;
	let pingTimer: NodeJS.Timeout | null = null;
	let keepaliveTimer: NodeJS.Timeout | null = null;
	let includeExplicit = false;
	let displayProject: string | null = null;
	let currentCtx: ExtensionContext | null = null;
	let currentInbound: InboundContext | null = null;
	let shuttingDown = false;

	const poolDeps = {
		getIdentity: () => identity,
		getDisplayProject: () => displayProject,
		getIncludeExplicit: () => includeExplicit,
		peerCards,
	};
	const renderPool = createRenderPool(poolDeps);

	const comsRuntime = new ComsRuntime({
		pi,
		getIdentity: () => identity,
		setCurrentInbound: (ctx) => {
			currentInbound = ctx;
		},
		getCurrentCtx: () => currentCtx,
		inboundQueue,
		pendingReplies,
		peerCards,
		getDisplayProject: () => displayProject,
		getIncludeExplicit: () => includeExplicit,
		renderPool,
	});

	const connHandler = (socket: net.Socket) => comsRuntime.connHandler(socket);
	const pingPeer = (endpoint: string) => comsRuntime.pingPeer(endpoint);
	const refreshPool = () => comsRuntime.refreshPool();

	registerComsTools(pi, {
		getIdentity: () => identity,
		getCurrentInbound: () => currentInbound,
		pendingReplies,
		pingPeer,
	});

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		if (server || identity) {
			await cleanShutdown();
		}
		shuttingDown = false;
		currentCtx = ctx;

		const flags = readCliFlags(pi);
		const fm = readFrontmatterFromArgv(process.argv);
		const project = flags.project || "default";
		const explicit = flags.explicit === true;
		const session_id = ulid();

		const defaultName = `agent-${session_id.slice(-6)}`;
		const desiredName = flags.name || fm.name || defaultName;
		const name = resolveUniqueName(project, desiredName);
		if (name !== desiredName) {
			try {
				pi.appendEntry("coms-log", { event: "name_collision", desired: desiredName, assigned: name, project });
			} catch {
				// best-effort
			}
		}
		const purpose = flags.purpose || fm.description || "";

		let color = fallbackColor(session_id);
		if (fm.color && isValidHex(fm.color)) {
			color = fm.color;
		}
		if (flags.color && isValidHex(flags.color)) {
			color = flags.color;
		}

		const endpoint = makeEndpoint(session_id);
		const cwd = ctx.cwd || process.cwd();
		const model = ctx.model?.id ?? "unknown";

		try {
			fs.mkdirSync(path.join(COMS_DIR, "projects", project, "agents"), { recursive: true });
			if (process.platform !== "win32") {
				fs.mkdirSync(path.join(COMS_DIR, "sockets"), { recursive: true });
				try { fs.chmodSync(COMS_DIR, 0o700); } catch { /* best-effort */ }
			}
		} catch (err) {
			ctx.ui?.notify?.(`📡 coms: failed to create dirs — ${err instanceof Error ? err.message : String(err)}`, "error");
			return;
		}

		try {
			server = await bindEndpoint(endpoint, connHandler);
		} catch (err) {
			ctx.ui?.notify?.(`📡 coms: bind failed — ${err instanceof Error ? err.message : String(err)}`, "error");
			return;
		}

		const entry: RegistryEntry = {
			session_id,
			name,
			purpose,
			model,
			color,
			pid: process.pid,
			endpoint,
			cwd,
			started_at: nowIso(),
			explicit,
			version: 1,
		};
		let registryFile: string;
		try {
			registryFile = writeRegistryAtomic(entry, project);
		} catch (err) {
			ctx.ui?.notify?.(`📡 coms: registry write failed — ${err instanceof Error ? err.message : String(err)}`, "error");
			try { server?.close(); } catch { /* ignore */ }
			return;
		}

		identity = {
			session_id,
			name,
			purpose,
			color,
			project,
			explicit,
			cwd,
			model,
			endpoint,
			registryFile,
		};
		includeExplicit = false;
		displayProject = project;

		try {
			pi.appendEntry("coms-log", { event: "boot", session_id, name, project });
		} catch {
			// best-effort
		}

		try {
			ctx.ui.setStatus("coms", `📡 ${name}@${project}`);
			installPoolWidget(ctx, renderPool);
			ctx.ui.notify(
				`📡 coms ready · ${name}@${project} · ${displayProject ?? project} pool`,
				"info",
			);
		} catch {
			// hasUI may be false in some contexts — non-fatal.
		}

		pingTimer = setInterval(() => { refreshPool().catch(() => {}); }, PING_INTERVAL_MS);
		try { (pingTimer as any).unref?.(); } catch { /* ignore */ }
		keepaliveTimer = setInterval(() => {
			if (!identity) return;
			try {
				const ctxInner = currentCtx;
				const missingBeforeWrite = !fs.existsSync(identity.registryFile);
				const live: RegistryEntry = {
					session_id: identity.session_id,
					name: identity.name,
					purpose: identity.purpose,
					model: ctxInner?.model?.id ?? identity.model,
					color: identity.color,
					pid: process.pid,
					endpoint: identity.endpoint,
					cwd: identity.cwd,
					started_at: nowIso(),
					explicit: identity.explicit,
					version: 1,
					context_used_pct: Math.round(ctxInner?.getContextUsage()?.percent ?? 0),
					queue_depth: inboundQueue.size,
					heartbeat_at: nowIso(),
				};
				writeRegistryAtomic(live, identity.project);
				if (missingBeforeWrite) {
					pi.appendEntry("coms-log", { event: "self_heal", session_id: identity.session_id, reason: "registry file missing" });
					if (!fs.existsSync(identity.registryFile)) {
						writeRegistryAtomic(live, identity.project);
					}
				}
			} catch { /* best-effort */ }
		}, KEEPALIVE_INTERVAL_MS);
		try { (keepaliveTimer as any).unref?.(); } catch { /* ignore */ }

		refreshPool().catch(() => {});
	});

	pi.on("agent_end", async (_event, ctx) => {
		const inbound = [...inboundQueue.values()].reverse().find((i) => !i.fulfilled);
		if (!inbound || !identity) return;

		let lastAssistantText = "";
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				const m = entry.message as any;
				if (typeof m.content === "string") {
					lastAssistantText = m.content;
				} else if (Array.isArray(m.content)) {
					lastAssistantText = m.content
						.filter((b: any) => b && b.type === "text")
						.map((b: any) => b.text)
						.join("\n");
				}
			}
		}

		let payload: any = lastAssistantText;
		let error: string | null = null;
		if (inbound.response_schema && typeof inbound.response_schema === "object") {
			try {
				payload = JSON.parse(lastAssistantText);
			} catch {
				error = "response not valid JSON";
				payload = null;
			}
		}

		const respEnv: ResponseEnvelope = {
			type: "response",
			msg_id: inbound.msg_id,
			sender_session: identity.session_id,
			sender_endpoint: identity.endpoint,
			hops: 0,
			timestamp: nowIso(),
			response: payload,
			error,
		};

		try {
			await sendEnvelope(inbound.sender_endpoint, respEnv);
			try {
				pi.appendEntry("coms-log", {
					event: "outbound_response",
					msg_id: inbound.msg_id,
					error,
				});
			} catch {
				// best-effort
			}
		} catch (e: any) {
			try {
				pi.appendEntry("coms-log", {
					event: "outbound_response_failed",
					msg_id: inbound.msg_id,
					reason: e?.message ?? String(e),
				});
			} catch {
				// best-effort
			}
		}

		inbound.fulfilled = true;
		inboundQueue.delete(inbound.msg_id);
		if (currentInbound && currentInbound.msg_id === inbound.msg_id) {
			currentInbound = null;
		}
	});

	pi.registerCommand("coms", {
		description: "Force-refresh the coms pool widget (or filter with --all / --project <name>)",
		handler: async (args, ctx) => {
			const trimmed = (args ?? "").trim();
			if (trimmed.includes("--all")) {
				includeExplicit = !includeExplicit;
				try { ctx.ui.notify(`coms: include_explicit = ${includeExplicit}`, "info"); } catch { /* ignore */ }
			}
			const projectMatch = trimmed.match(/--project\s+(\S+)/);
			if (projectMatch) {
				displayProject = projectMatch[1];
				try { ctx.ui.notify(`coms: displaying project ${displayProject}`, "info"); } catch { /* ignore */ }
			}
			await refreshPool();
		},
	});

	async function cleanShutdown(): Promise<void> {
		if (shuttingDown) return;
		shuttingDown = true;
		if (pingTimer) { try { clearInterval(pingTimer); } catch { /* ignore */ } pingTimer = null; }
		if (keepaliveTimer) { try { clearInterval(keepaliveTimer); } catch { /* ignore */ } keepaliveTimer = null; }
		if (server) {
			try { server.close(); } catch { /* ignore */ }
			server = null;
		}
		if (identity) {
			if (process.platform !== "win32") {
				try { fs.unlinkSync(identity.endpoint); } catch { /* ignore */ }
			}
			try { removeRegistryEntry(identity.project, identity.name); } catch { /* ignore */ }
			try {
				pi.appendEntry("coms-log", { event: "shutdown", session_id: identity.session_id });
			} catch { /* best-effort */ }
		}
		if (currentCtx?.hasUI) {
			try { currentCtx.ui.setWidget("coms-pool", undefined); } catch { /* ignore */ }
		}
		for (const [msgId, entry] of pendingReplies.entries()) {
			if (entry.timer) {
				try { clearTimeout(entry.timer); } catch { /* ignore */ }
				entry.timer = null;
			}
			if (!entry.result) {
				entry.result = { error: "shutdown" };
				try { entry.resolve(entry.result); } catch { /* ignore */ }
			}
			pendingReplies.delete(msgId);
		}
	}

	pi.on("session_shutdown", async () => { await cleanShutdown(); });
	process.on("SIGINT", () => { void cleanShutdown(); });
	process.on("SIGTERM", () => { void cleanShutdown(); });
}
