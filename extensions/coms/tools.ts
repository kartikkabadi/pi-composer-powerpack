import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { nowIso, ulid } from "./protocol.ts";
import { listProjects, pruneDeadEntries, resolveTarget } from "./registry.ts";
import { sendEnvelope } from "./transport.ts";
import {
	MAX_HOPS,
	TIMEOUT_MS,
	type AgentCard,
	type ComsIdentity,
	type InboundContext,
	type PendingReply,
	type PromptEnvelope,
	type RegistryEntry,
} from "./types.ts";

/** Dependency bag for coms tool registration. */
export interface ComsToolsDeps {
	getIdentity: () => ComsIdentity | null;
	getCurrentInbound: () => InboundContext | null;
	pendingReplies: Map<string, PendingReply>;
	pingPeer: (endpoint: string) => Promise<AgentCard | null>;
}

/** Register coms_list, coms_send, coms_get, coms_await, and coms_reply tools with the Pi extension API. */
export function registerComsTools(pi: ExtensionAPI, deps: ComsToolsDeps): void {
	pi.registerTool({
		name: "coms_list",
		label: "Coms List",
		description:
			"List peer agents discoverable via coms. Returns names, models, and live context-window usage. " +
			"Use project=\"*\" to scan all projects. include_explicit=true reveals agents marked --explicit.",
		parameters: Type.Object({
			project: Type.Optional(Type.String({ description: "Project name, or \"*\" for all projects. Defaults to caller's project." })),
			include_explicit: Type.Optional(Type.Boolean({ description: "Include agents launched with --explicit. Default false." })),
		}),
		async execute(_callId, params) {
			const identity = deps.getIdentity();
			const includeExp = params.include_explicit === true;
			const projectFilter = params.project ?? identity?.project ?? "default";
			const projects = projectFilter === "*" ? listProjects() : [projectFilter];

			const collected: { entry: RegistryEntry; project: string }[] = [];
			for (const proj of projects) {
				for (const entry of pruneDeadEntries(proj)) {
					if (entry.explicit && !includeExp) continue;
					if (identity && entry.session_id === identity.session_id) continue;
					collected.push({ entry, project: proj });
				}
			}

			const pongs = await Promise.allSettled(collected.map((c) => deps.pingPeer(c.entry.endpoint)));

			const agents = collected.map((c, i) => {
				const r = pongs[i];
				const pong = r.status === "fulfilled" ? r.value : null;
				return {
					name: c.entry.name,
					session_id: c.entry.session_id,
					purpose: c.entry.purpose,
					model: c.entry.model,
					cwd: c.entry.cwd,
					project: c.project,
					alive: pong != null,
					context_used_pct: pong ? pong.context_used_pct : null,
					color: c.entry.color,
				};
			});

			const lines = agents.length === 0
				? "No peer agents found."
				: agents.map((a) => {
					const ctxStr = a.context_used_pct != null ? ` ${a.context_used_pct}%` : " ?%";
					const live = a.alive ? "●" : "✗";
					return `${live} ${a.name} (${a.model})${ctxStr}${a.purpose ? ` — ${a.purpose}` : ""}`;
				}).join("\n");

			return {
				content: [{ type: "text" as const, text: `${agents.length} peer(s):\n${lines}` }],
				details: { agents, project: projectFilter },
			};
		},
		renderCall(args, theme) {
			const proj = (args as any).project;
			const filter = proj ? ` ${proj}` : "";
			return new Text(
				theme.fg("toolTitle", theme.bold("coms_list")) + theme.fg("dim", filter),
				0, 0,
			);
		},
		renderResult(result, options, theme) {
			const details = result.details as any;
			const agents: any[] = details?.agents ?? [];
			const header = theme.fg("accent", `📡 ${agents.length} peer(s)`);
			if (!options.expanded || agents.length === 0) {
				return new Text(header, 0, 0);
			}
			const rows = agents.map((a) => {
				const dot = a.alive ? theme.fg("success", "●") : theme.fg("error", "✗");
				const pct = a.context_used_pct != null ? `${a.context_used_pct}%` : "?%";
				return `${dot} ${theme.fg("accent", a.name)} ${theme.fg("dim", a.model)} ${theme.fg("warning", pct)}`;
			}).join("\n");
			return new Text(header + "\n" + rows, 0, 0);
		},
	});

	pi.registerTool({
		name: "coms_send",
		label: "Coms Send",
		description:
			"Send a prompt to a peer agent. Returns synchronously with a msg_id once the receiver acks. " +
			"Use coms_get (non-blocking) or coms_await (blocking) with the msg_id to retrieve the response. " +
			"Throws if the receiver is unreachable or rejects the envelope.",
		parameters: Type.Object({
			target: Type.String({ description: "Peer name (preferred, scoped to your project) or session_id (global)." }),
			prompt: Type.String({ description: "The prompt to send." }),
			conversation_id: Type.Optional(Type.String()),
			response_schema: Type.Optional(Type.Any({ description: "Optional JSON Schema describing the expected response shape." })),
		}),
		async execute(_callId, params) {
			const identity = deps.getIdentity();
			if (!identity) {
				throw new Error("coms not initialised");
			}
			const currentInbound = deps.getCurrentInbound();
			const target = resolveTarget(params.target, identity);
			if (!target) {
				throw new Error(`coms: no live agent matching "${params.target}"`);
			}
			const hops = currentInbound ? currentInbound.hops + 1 : 0;
			if (hops >= MAX_HOPS) {
				throw new Error(`coms: hop limit reached (${hops} >= ${MAX_HOPS})`);
			}
			const msg_id = ulid();
			const env: PromptEnvelope = {
				type: "prompt",
				msg_id,
				sender_session: identity.session_id,
				sender_endpoint: identity.endpoint,
				sender_name: identity.name,
				sender_cwd: identity.cwd,
				hops,
				timestamp: nowIso(),
				prompt: params.prompt,
				conversation_id: params.conversation_id ?? null,
				response_schema: (params.response_schema as object | undefined) ?? null,
			};

			let resolveFn!: (v: { response?: any; error?: string | null }) => void;
			let rejectFn!: (e: Error) => void;
			const promise = new Promise<{ response?: any; error?: string | null }>((res, rej) => {
				resolveFn = res;
				rejectFn = rej;
			});
			const entry: PendingReply = {
				resolve: resolveFn,
				reject: rejectFn,
				timer: null,
				promise,
				target_name: target.name,
				created_at: nowIso(),
			};
			entry.timer = setTimeout(() => {
				if (entry.result) return;
				entry.result = { error: "timeout" };
				try { entry.resolve(entry.result); } catch { /* ignore */ }
			}, TIMEOUT_MS);
			try { (entry.timer as any).unref?.(); } catch { /* ignore */ }
			deps.pendingReplies.set(msg_id, entry);

			try {
				await sendEnvelope(target.endpoint, env);
			} catch (err) {
				deps.pendingReplies.delete(msg_id);
				if (entry.timer) {
					try { clearTimeout(entry.timer); } catch { /* ignore */ }
					entry.timer = null;
				}
				throw err;
			}

			try {
				pi.appendEntry("coms-log", {
					event: "outbound_prompt",
					msg_id,
					target: target.name,
					hops,
				});
			} catch {
				// best-effort
			}

			return {
				content: [{ type: "text" as const, text: `coms_send → ${target.name}\nmsg_id ${msg_id}\nhops ${hops}` }],
				details: { msg_id, target: target.name, target_session: target.session_id, hops },
			};
		},
		renderCall(args, theme) {
			const tgt = (args as any).target ?? "?";
			const prompt = (args as any).prompt ?? "";
			const preview = prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;
			return new Text(
				theme.fg("toolTitle", theme.bold("coms_send ")) +
				theme.fg("accent", tgt) +
				theme.fg("dim", " — ") +
				theme.fg("muted", preview),
				0, 0,
			);
		},
		renderResult(result, _options, theme) {
			const d = result.details as any;
			if (!d) {
				const t = result.content[0];
				return new Text(t?.type === "text" ? t.text : "", 0, 0);
			}
			return new Text(
				theme.fg("success", "→ ") +
				theme.fg("accent", d.target) +
				theme.fg("dim", `  msg_id `) +
				theme.fg("warning", d.msg_id),
				0, 0,
			);
		},
	});

	pi.registerTool({
		name: "coms_get",
		label: "Coms Get",
		description:
			"Non-blocking poll of a pending coms_send reply. Returns status pending|complete|error and (when complete) the response.",
		parameters: Type.Object({
			msg_id: Type.String({ description: "msg_id returned by coms_send." }),
		}),
		async execute(_callId, params, _signal, _onUpdate, _ctx) {
			const entry = deps.pendingReplies.get(params.msg_id);
			if (!entry) {
				return {
					content: [{ type: "text" as const, text: `coms_get: unknown msg_id ${params.msg_id}` }],
					details: { status: "error" as const, error: "unknown msg_id" },
				};
			}
			if (entry.result) {
				const r = entry.result;
				const text = r.error
					? `coms_get: error — ${r.error}`
					: `coms_get: complete\n${typeof r.response === "string" ? r.response : JSON.stringify(r.response, null, 2)}`;
				return {
					content: [{ type: "text" as const, text }],
					details: { status: "complete" as const, response: r.response, error: r.error ?? null },
				};
			}
			return {
				content: [{ type: "text" as const, text: `coms_get: pending` }],
				details: { status: "pending" as const },
			};
		},
		renderCall(args, theme) {
			const id = (args as any).msg_id ?? "?";
			return new Text(
				theme.fg("toolTitle", theme.bold("coms_get ")) + theme.fg("warning", id),
				0, 0,
			);
		},
		renderResult(result, _options, theme) {
			const d = result.details as any;
			const status = d?.status ?? "?";
			const color = status === "complete" ? "success" : status === "pending" ? "warning" : "error";
			return new Text(theme.fg(color, status), 0, 0);
		},
	});

	pi.registerTool({
		name: "coms_await",
		label: "Coms Await",
		description:
			"Block until a pending coms_send reply lands or the timeout fires. Default timeout 30 minutes (PI_COMS_TIMEOUT_MS).",
		parameters: Type.Object({
			msg_id: Type.String({ description: "msg_id returned by coms_send." }),
			timeout_ms: Type.Optional(Type.Number({ description: "Override the default timeout (ms)." })),
		}),
		async execute(_callId, params, _signal, _onUpdate, _ctx) {
			const entry = deps.pendingReplies.get(params.msg_id);
			if (!entry) {
				return {
					content: [{ type: "text" as const, text: `coms_await: unknown msg_id ${params.msg_id}` }],
					details: { error: "unknown msg_id" as const },
				};
			}
			const timeoutMs = typeof params.timeout_ms === "number" && params.timeout_ms > 0
				? params.timeout_ms
				: TIMEOUT_MS;

			const timed = new Promise<{ error: string }>((resolve) => {
				const t = setTimeout(() => resolve({ error: "timeout" }), timeoutMs);
				try { (t as NodeJS.Timeout).unref?.(); } catch { /* ignore */ }
			});

			const winner = await Promise.race([entry.promise, timed]);
			if ("error" in winner && winner.error) {
				return {
					content: [{ type: "text" as const, text: `coms_await: error — ${winner.error}` }],
					details: { error: winner.error },
				};
			}
			const resp = "response" in winner ? winner.response : undefined;
			return {
				content: [{ type: "text" as const, text: typeof resp === "string" ? resp : JSON.stringify(resp, null, 2) }],
				details: { response: resp },
			};
		},
		renderCall(args, theme) {
			const id = (args as any).msg_id ?? "?";
			return new Text(
				theme.fg("toolTitle", theme.bold("coms_await ")) + theme.fg("warning", id),
				0, 0,
			);
		},
		renderResult(result, _options, theme) {
			const d = result.details as any;
			if (d?.error) return new Text(theme.fg("error", `✗ ${d.error}`), 0, 0);
			return new Text(theme.fg("success", "✓ response received"), 0, 0);
		},
	});
}
