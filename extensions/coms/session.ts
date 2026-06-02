/**
 * coms/session — Session lifecycle management for coms extension.
 *
 * Extracts boot, keepalive, response-capture, shutdown, and /coms command
 * handling from the monolithic index.ts. The index module wires these into
 * the Pi extension API.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type Server, type Socket } from "node:net";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
	fallbackColor,
	isValidHex,
	makeEndpoint,
	nowIso,
	readCliFlags,
	readFrontmatterFromArgv,
	ulid,
} from "./protocol.ts";
import type { ComsRuntime } from "./runtime.ts";
import {
	removeRegistryEntry,
	resolveUniqueName,
	writeRegistryAtomic,
} from "./registry.ts";
import { bindEndpoint, sendEnvelope } from "./transport.ts";
import {
	COMS_DIR,
	KEEPALIVE_INTERVAL_MS,
	PING_INTERVAL_MS,
	type ComsIdentity,
	type InboundContext,
	type PendingReply,
	type RegistryEntry,
	type ResponseEnvelope,
} from "./types.ts";
import { createRenderPool, installPoolWidget } from "./widget.ts";

/** Mutable state for the coms session lifecycle. */
export interface ComsSessionState {
	identity: ComsIdentity | null;
	server: Server | null;
	pingTimer: NodeJS.Timeout | null;
	keepaliveTimer: NodeJS.Timeout | null;
	includeExplicit: boolean;
	displayProject: string | null;
	currentCtx: ExtensionContext | null;
	currentInbound: InboundContext | null;
	shuttingDown: boolean;
}

/**
 * Create a fresh ComsSessionState with all fields null/false.
 *
 * @returns A new session state object
 */
export function createSessionState(): ComsSessionState {
	return {
		identity: null,
		server: null,
		pingTimer: null,
		keepaliveTimer: null,
		includeExplicit: false,
		displayProject: null,
		currentCtx: null,
		currentInbound: null,
		shuttingDown: false,
	};
}

/**
 * Boot the coms session.
 *
 * Resolves identity, binds endpoint, registers in the pool, and starts timers.
 *
 * @param pi - The extension API
 * @param state - The session state to initialize
 * @param ctx - The extension context
 * @param runtime - The coms runtime
 * @param renderPool - The render pool for UI updates
 * @param inboundQueue - Queue for inbound messages
 */
export async function bootSession(
	pi: ExtensionAPI,
	state: ComsSessionState,
	ctx: ExtensionContext,
	runtime: ComsRuntime,
	renderPool: ReturnType<typeof createRenderPool>,
	inboundQueue: Map<string, InboundContext>,
): Promise<void> {
	if (state.server || state.identity) {
		await cleanShutdown(pi, state, inboundQueue, new Map());
	}
	state.shuttingDown = false;
	state.currentCtx = ctx;

	const flags = readCliFlags(pi);
	const fm = readFrontmatterFromArgv(process.argv);
	const project = flags.project || "default";
	const explicit = flags.explicit === true;
	const session_id = ulid();

	const display_name = flags.name || fm.name || "agent";
	const purpose = flags.purpose || fm.purpose || "Pi agent";
	const model = process.env.PI_MODEL || "unknown";
	const color = flags.color || fm.color || fallbackColor(session_id);
	const cwd = process.cwd();

	state.identity = {
		session_id,
		name: display_name,
		purpose,
		model,
		color,
		cwd,
		project,
	};

	state.displayProject = project;
	state.includeExplicit = explicit;

	const endpoint = makeEndpoint(session_id);
	const socketsDir = join(COMS_DIR, "sockets");
	if (!existsSync(socketsDir)) {
		mkdirSync(socketsDir, { recursive: true });
	}

	try {
		state.server = await runtime.bindEndpoint(endpoint, (socket: Socket) => {
			runtime.handleConnection(socket);
		});
		if (process.platform !== "win32") {
			try { chmodSync(endpoint, 0o600); } catch { /* ignore */ }
		}

		const entry: RegistryEntry = {
			session_id,
			name: display_name,
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
		writeRegistryAtomic(entry, project);

		state.pingTimer = setInterval(() => {
			runtime.discoveryPing();
		}, PING_INTERVAL_MS);

		state.keepaliveTimer = setInterval(() => {
			runtime.keepalive();
		}, KEEPALIVE_INTERVAL_MS);

		ctx.ui.notify(`coms: ${display_name} online (${endpoint})`, "info");
	} catch (err) {
		ctx.ui.notify(`coms: failed to start — ${err}`, "error");
	}
}

/**
 * Handle agent end event.
 *
 * @param state - The session state
 * @param inboundQueue - Queue for inbound messages
 * @param pendingReplies - Map of pending replies
 */
export function handleAgentEnd(
	state: ComsSessionState,
	inboundQueue: Map<string, InboundContext>,
	pendingReplies: Map<string, PendingReply>,
): void {
	// Clear inbound state
	state.currentInbound = null;
}

/**
 * Clean shutdown of the coms session.
 *
 * @param pi - The extension API
 * @param state - The session state to clean up
 * @param inboundQueue - Queue for inbound messages
 * @param pendingReplies - Map of pending replies
 */
export async function cleanShutdown(
	pi: ExtensionAPI,
	state: ComsSessionState,
	inboundQueue: Map<string, InboundContext>,
	pendingReplies: Map<string, PendingReply>,
): Promise<void> {
	if (state.shuttingDown) return;
	state.shuttingDown = true;

	if (state.pingTimer) {
		clearInterval(state.pingTimer);
		state.pingTimer = null;
	}

	if (state.keepaliveTimer) {
		clearInterval(state.keepaliveTimer);
		state.keepaliveTimer = null;
	}

	if (state.identity) {
		removeRegistryEntry(state.identity.project, state.identity.name);
	}

	if (state.server) {
		try {
			state.server.close();
		} catch {
			// ignore
		}
		state.server = null;
	}

	// Clear pending replies
	for (const [, reply] of pendingReplies) {
		clearTimeout(reply.timer);
		reply.reject(new Error("coms shutting down"));
	}
	pendingReplies.clear();

	state.identity = null;
}

	const defaultName = `agent-${session_id.slice(-6)}`;
	const desiredName = flags.name || fm.name || defaultName;
	const name = resolveUniqueName(project, desiredName);
	if (name !== desiredName) {
		try {
			pi.appendEntry("coms-log", { event: "name_collision", desired: desiredName, assigned: name, project });
		} catch { /* best-effort */ }
	}
	const purpose = flags.purpose || fm.description || "";

	let color = fallbackColor(session_id);
	if (fm.color && isValidHex(fm.color)) color = fm.color;
	if (flags.color && isValidHex(flags.color)) color = flags.color;

	const endpoint = makeEndpoint(session_id);
	const cwd = ctx.cwd || process.cwd();
	const model = ctx.model?.id ?? "unknown";

	try {
		mkdirSync(join(COMS_DIR, "projects", project, "agents"), { recursive: true });
		if (process.platform !== "win32") {
			mkdirSync(join(COMS_DIR, "sockets"), { recursive: true });
			try { chmodSync(COMS_DIR, 0o700); } catch { /* best-effort */ }
		}
	} catch (err) {
		ctx.ui?.notify?.(`📡 coms: failed to create dirs — ${err instanceof Error ? err.message : String(err)}`, "error");
		return;
	}

	const connHandler = (socket: Socket) => runtime.connHandler(socket);
	try {
		state.server = await bindEndpoint(endpoint, connHandler);
	} catch (err) {
		ctx.ui?.notify?.(`📡 coms: bind failed — ${err instanceof Error ? err.message : String(err)}`, "error");
		return;
	}

	const entry: RegistryEntry = {
		session_id, name, purpose, model, color,
		pid: process.pid, endpoint, cwd,
		started_at: nowIso(), explicit, version: 1,
	};
	let registryFile: string;
	try {
		registryFile = writeRegistryAtomic(entry, project);
	} catch (err) {
		ctx.ui?.notify?.(`📡 coms: registry write failed — ${err instanceof Error ? err.message : String(err)}`, "error");
		try { state.server?.close(); } catch { /* ignore */ }
		return;
	}

	state.identity = {
		session_id, name, purpose, color, project,
		explicit, cwd, model, endpoint, registryFile,
	};
	state.includeExplicit = false;
	state.displayProject = project;

	try {
		pi.appendEntry("coms-log", { event: "boot", session_id, name, project });
	} catch { /* best-effort */ }

	try {
		ctx.ui.setStatus("coms", `📡 ${name}@${project}`);
		installPoolWidget(ctx, renderPool);
		ctx.ui.notify(`📡 coms ready · ${name}@${project} · ${state.displayProject ?? project} pool`, "info");
	} catch { /* hasUI may be false */ }

	const refreshPool = () => runtime.refreshPool();
	state.pingTimer = setInterval(() => { refreshPool().catch(() => {}); }, PING_INTERVAL_MS);
	try { (state.pingTimer as any).unref?.(); } catch { /* ignore */ }

	state.keepaliveTimer = setInterval(() => {
		if (!state.identity) return;
		try {
			const ctxInner = state.currentCtx;
			const missingBeforeWrite = !existsSync(state.identity.registryFile);
			const live: RegistryEntry = {
				session_id: state.identity.session_id,
				name: state.identity.name,
				purpose: state.identity.purpose,
				model: ctxInner?.model?.id ?? state.identity.model,
				color: state.identity.color,
				pid: process.pid,
				endpoint: state.identity.endpoint,
				cwd: state.identity.cwd,
				started_at: nowIso(),
				explicit: state.identity.explicit,
				version: 1,
				context_used_pct: Math.round((ctxInner as any)?.getContextUsage?.()?.percent ?? 0),
				queue_depth: inboundQueue.size,
				heartbeat_at: nowIso(),
			};
			writeRegistryAtomic(live, state.identity.project);
			if (missingBeforeWrite) {
				pi.appendEntry("coms-log", { event: "self_heal", session_id: state.identity.session_id, reason: "registry file missing" });
				if (!existsSync(state.identity.registryFile)) {
					writeRegistryAtomic(live, state.identity.project);
				}
			}
		} catch { /* best-effort */ }
	}, KEEPALIVE_INTERVAL_MS);
	try { (state.keepaliveTimer as any).unref?.(); } catch { /* ignore */ }

	refreshPool().catch(() => {});
}

/** Fulfill the most recent unfulfilled inbound request with the agent's last response. */
export async function handleAgentEnd(
	pi: ExtensionAPI,
	state: ComsSessionState,
	inboundQueue: Map<string, InboundContext>,
	ctx: ExtensionContext,
): Promise<void> {
	const inbound = [...inboundQueue.values()].reverse().find((i) => !i.fulfilled);
	if (!inbound || !state.identity) return;

	let lastAssistantText = "";
	for (const entry of (ctx as any).sessionManager.getBranch()) {
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
		sender_session: state.identity.session_id,
		sender_endpoint: state.identity.endpoint,
		hops: 0,
		timestamp: nowIso(),
		response: payload,
		error,
	};

	try {
		await sendEnvelope(inbound.sender_endpoint, respEnv);
		try {
			pi.appendEntry("coms-log", { event: "outbound_response", msg_id: inbound.msg_id, error });
		} catch { /* best-effort */ }
	} catch (e: any) {
		try {
			pi.appendEntry("coms-log", { event: "outbound_response_failed", msg_id: inbound.msg_id, reason: e?.message ?? String(e) });
		} catch { /* best-effort */ }
	}

	inbound.fulfilled = true;
	inboundQueue.delete(inbound.msg_id);
	if (state.currentInbound && state.currentInbound.msg_id === inbound.msg_id) {
		state.currentInbound = null;
	}
}

/** Gracefully shut down coms: stop timers, close server, remove registry entry, reject pending replies. */
export async function cleanShutdown(
	pi: ExtensionAPI,
	state: ComsSessionState,
	_inboundQueue: Map<string, InboundContext>,
	pendingReplies: Map<string, PendingReply>,
): Promise<void> {
	if (state.shuttingDown) return;
	state.shuttingDown = true;
	if (state.pingTimer) { try { clearInterval(state.pingTimer); } catch { /* ignore */ } state.pingTimer = null; }
	if (state.keepaliveTimer) { try { clearInterval(state.keepaliveTimer); } catch { /* ignore */ } state.keepaliveTimer = null; }
	if (state.server) {
		try { state.server.close(); } catch { /* ignore */ }
		state.server = null;
	}
	if (state.identity) {
		if (process.platform !== "win32") {
			try { unlinkSync(state.identity.endpoint); } catch { /* ignore */ }
		}
		try { removeRegistryEntry(state.identity.project, state.identity.name); } catch { /* ignore */ }
		try {
			pi.appendEntry("coms-log", { event: "shutdown", session_id: state.identity.session_id });
		} catch { /* best-effort */ }
	}
	if ((state.currentCtx as any)?.hasUI) {
		try { (state.currentCtx as any).ui.setWidget("coms-pool", undefined); } catch { /* ignore */ }
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
