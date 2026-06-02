import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Socket } from "node:net";
import { isValidEnvelope, makePingEnvelope } from "./protocol.ts";
import { pruneDeadEntries, pruneDeadEntriesAllProjects } from "./registry.ts";
import { readOneLineCapped, sendEnvelope } from "./transport.ts";
import { installPoolWidget } from "./widget.ts";
import {
	LINE_CAP_BYTES,
	MAX_HOPS,
	type AgentCard,
	type ComsIdentity,
	type InboundContext,
	type PendingReply,
	type PingEnvelope,
	type Pong,
	type PromptEnvelope,
	type ResponseEnvelope,
} from "./types.ts";

/** Write an ack JSON response and close the socket. Errors are silently ignored. */
export function ackOk(socket: Socket, msg_id: string): void {
	try {
		socket.write(JSON.stringify({ type: "ack", msg_id }) + "\n");
	} catch {
		// ignore
	}
	try {
		socket.end();
	} catch {
		/* ignore */
	}
}

/** Write a nack JSON response with an error message and close the socket. Errors are silently ignored. */
export function nack(socket: Socket, msg_id: string, error: string): void {
	try {
		socket.write(JSON.stringify({ type: "nack", msg_id, error }) + "\n");
	} catch {
		// ignore
	}
	try {
		socket.end();
	} catch {
		/* ignore */
	}
}

/** Dependency bag injected into ComsRuntime for testability and decoupling from the Pi extension API. */
export type ComsRuntimeDeps = {
	pi: ExtensionAPI;
	getIdentity: () => ComsIdentity | null;
	setCurrentInbound: (ctx: InboundContext | null) => void;
	getCurrentCtx: () => ExtensionContext | null;
	inboundQueue: Map<string, InboundContext>;
	pendingReplies: Map<string, PendingReply>;
	peerCards: Map<string, AgentCard & { staleCount: number }>;
	getDisplayProject: () => string | null;
	getIncludeExplicit: () => boolean;
	renderPool: (width: number, theme: any) => string[];
};

/** Core runtime that handles inbound prompts, outbound responses, pings, and peer discovery. */
export class ComsRuntime {
	constructor(private readonly deps: ComsRuntimeDeps) {}

	handlePrompt(socket: Socket, env: PromptEnvelope): void {
		if (typeof env.hops !== "number" || env.hops >= MAX_HOPS) {
			nack(socket, env.msg_id, "hops exceeded");
			return;
		}

		const inbound: InboundContext = {
			msg_id: env.msg_id,
			hops: env.hops,
			sender_endpoint: env.sender_endpoint,
			sender_session: env.sender_session,
			response_schema: env.response_schema ?? null,
			fulfilled: false,
		};
		this.deps.inboundQueue.set(env.msg_id, inbound);
		this.deps.setCurrentInbound(inbound);

		try {
			this.deps.pi.sendMessage(
				{
					customType: "coms-inbound",
					content: `[from ${env.sender_name} @ ${env.sender_cwd}]\n\n${env.prompt}`,
					display: true,
					details: {
						msg_id: env.msg_id,
						sender_session: env.sender_session,
						response_schema: env.response_schema ?? null,
					},
				},
				{ deliverAs: "followUp", triggerTurn: true },
			);
		} catch {
			this.deps.inboundQueue.delete(env.msg_id);
			this.deps.setCurrentInbound(null);
			nack(socket, env.msg_id, "internal error");
			return;
		}

		ackOk(socket, env.msg_id);
		try {
			this.deps.pi.appendEntry("coms-log", {
				event: "inbound_prompt",
				msg_id: env.msg_id,
				sender: env.sender_session,
				hops: env.hops,
			});
		} catch {
			// best-effort
		}
	}

	handleResponse(socket: Socket, env: ResponseEnvelope): void {
		const pending = this.deps.pendingReplies.get(env.msg_id);
		if (pending) {
			if (pending.timer) {
				try {
					clearTimeout(pending.timer);
				} catch {
					/* ignore */
				}
				pending.timer = null;
			}
			pending.result = { response: env.response, error: env.error ?? null };
			try {
				pending.resolve(pending.result);
			} catch {
				// ignore
			}
		} else {
			try {
				this.deps.pi.appendEntry("coms-log", { event: "orphan_response", msg_id: env.msg_id });
			} catch {
				// best-effort
			}
		}
		ackOk(socket, env.msg_id);
	}

	handlePing(socket: Socket, env: PingEnvelope): void {
		const ctx = this.deps.getCurrentCtx();
		const ident = this.deps.getIdentity();
		const pct = ctx ? Math.round(ctx.getContextUsage()?.percent ?? 0) : 0;
		const card: AgentCard = {
			name: ident?.name ?? "unknown",
			purpose: ident?.purpose ?? "",
			model: ctx?.model?.id ?? ident?.model ?? "unknown",
			color: ident?.color ?? "#36F9F6",
			context_used_pct: pct,
			queue_depth: this.deps.inboundQueue.size,
		};
		const pong: Pong = { type: "pong", msg_id: env.msg_id, agent_card: card };
		try {
			socket.write(JSON.stringify(pong) + "\n");
		} catch {
			// ignore
		}
		try {
			socket.end();
		} catch {
			/* ignore */
		}
	}

	connHandler(socket: Socket): void {
		void readOneLineCapped(socket, LINE_CAP_BYTES)
			.then((line) => {
				let parsed: unknown;
				try {
					parsed = JSON.parse(line);
				} catch {
					nack(socket, "", "malformed envelope");
					return;
				}
				if (!isValidEnvelope(parsed)) {
					const mid =
						parsed &&
						typeof parsed === "object" &&
						typeof (parsed as { msg_id?: unknown }).msg_id === "string"
							? (parsed as { msg_id: string }).msg_id
							: "";
					nack(socket, mid, "malformed envelope");
					return;
				}
				try {
					if (parsed.type === "prompt") {
						this.handlePrompt(socket, parsed as PromptEnvelope);
					} else if (parsed.type === "response") {
						this.handleResponse(socket, parsed as ResponseEnvelope);
					} else if (parsed.type === "ping") {
						this.handlePing(socket, parsed as PingEnvelope);
					} else {
						nack(socket, parsed.msg_id, "unknown type");
					}
				} catch {
					nack(socket, parsed.msg_id, "internal error");
				}
			})
			.catch(() => {
				nack(socket, "", "malformed envelope");
			});
		socket.once("error", () => {
			try {
				socket.destroy();
			} catch {
				/* ignore */
			}
		});
	}

	async pingPeer(endpoint: string): Promise<AgentCard | null> {
		const identity = this.deps.getIdentity();
		if (!identity) return null;
		const env = makePingEnvelope(identity.session_id, identity.endpoint);
		try {
			const resp = await sendEnvelope(endpoint, env);
			if (resp?.type === "pong" && resp.agent_card) {
				return resp.agent_card as AgentCard;
			}
		} catch {
			// ignore
		}
		return null;
	}

	async refreshPool(): Promise<void> {
		const identity = this.deps.getIdentity();
		if (!identity) return;
		const projectFilter = this.deps.getDisplayProject() ?? identity.project;
		const live =
			projectFilter === "*"
				? pruneDeadEntriesAllProjects()
				: pruneDeadEntries(projectFilter);

		const peers = live.filter(
			(e) =>
				e.session_id !== identity.session_id &&
				(this.deps.getIncludeExplicit() || !e.explicit),
		);

		const results = await Promise.allSettled(
			peers.map(async (peer) => {
				const pingEnv = makePingEnvelope(identity.session_id, identity.endpoint);
				const reply = await sendEnvelope(peer.endpoint, pingEnv);
				return { peer, pong: reply as Pong };
			}),
		);

		const seenSessions = new Set<string>();
		let changed = false;

		for (const r of results) {
			if (r.status === "fulfilled" && r.value.pong?.agent_card) {
				const { peer, pong } = r.value;
				seenSessions.add(peer.session_id);
				const prev = this.deps.peerCards.get(peer.session_id);
				const next = { ...pong.agent_card, staleCount: 0 };
				if (!prev || JSON.stringify({ ...prev, staleCount: 0 }) !== JSON.stringify(next)) {
					this.deps.peerCards.set(peer.session_id, next);
					changed = true;
				}
			}
		}

		for (const [sid, card] of this.deps.peerCards.entries()) {
			if (sid === identity.session_id) continue;
			if (!seenSessions.has(sid)) {
				card.staleCount = (card.staleCount ?? 0) + 1;
				if (card.staleCount > 6) {
					this.deps.peerCards.delete(sid);
				}
				changed = true;
			}
		}

		const ctx = this.deps.getCurrentCtx();
		if (changed && ctx?.hasUI) {
			installPoolWidget(ctx, this.deps.renderPool);
		}
	}
}
