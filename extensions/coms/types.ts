import { homedir } from "node:os";
import { join } from "node:path";

/** Root directory for coms runtime data (~/.pi/coms). Override with PI_COMS_DIR. */
export const COMS_DIR = process.env.PI_COMS_DIR || join(homedir(), ".pi", "coms");
/** Maximum hop count before a message is rejected. Override with PI_COMS_MAX_HOPS. */
export const MAX_HOPS = Number(process.env.PI_COMS_MAX_HOPS) || 5;
/** Timeout in ms for a pending response. Override with PI_COMS_TIMEOUT_MS. */
export const TIMEOUT_MS = Number(process.env.PI_COMS_TIMEOUT_MS) || 1_800_000;
/** Timeout in ms to wait for an ack after sending an envelope. Override with PI_COMS_ACK_TIMEOUT_MS. */
export const ACK_TIMEOUT_MS = Number(process.env.PI_COMS_ACK_TIMEOUT_MS) || 15_000;
/** Interval in ms between peer discovery pings. Override with PI_COMS_PING_INTERVAL_MS. */
export const PING_INTERVAL_MS = Number(process.env.PI_COMS_PING_INTERVAL_MS) || 10_000;
/** Interval in ms between keepalive heartbeats written to the registry. */
export const KEEPALIVE_INTERVAL_MS = 30_000;
/** Maximum bytes read from a single envelope line on the wire. */
export const LINE_CAP_BYTES = 64 * 1024;

/** Deterministic fallback color palette for agents without an explicit color. */
export const FALLBACK_PALETTE = [
	"#72F1B8", "#36F9F6", "#FF7EDB", "#FEDE5D",
	"#C792EA", "#FF8B39", "#4D9DE0", "#FFAA8B",
];

/** Discriminator union for coms envelope types. */
export type EnvelopeType = "prompt" | "response" | "ping";

/** Base envelope carried over the wire between coms peers. */
export interface Envelope {
	type: EnvelopeType;
	msg_id: string;
	sender_session: string;
	sender_endpoint: string;
	hops: number;
	timestamp: string;
}

/** Outbound prompt envelope sent to a peer agent. */
export interface PromptEnvelope extends Envelope {
	type: "prompt";
	prompt: string;
	sender_name: string;
	sender_cwd: string;
	conversation_id?: string | null;
	response_schema?: object | null;
}

/** Response envelope returned after a prompt is processed by the receiver. */
export interface ResponseEnvelope extends Envelope {
	type: "response";
	response: any;
	error?: string | null;
}

/** Ping envelope used for peer discovery. */
export interface PingEnvelope extends Envelope {
	type: "ping";
}

/** Public card returned by a peer in a pong response. */
export interface AgentCard {
	name: string;
	purpose: string;
	model: string;
	color: string;
	context_used_pct: number;
	queue_depth: number;
}

/** Pong reply containing the responder's agent card. */
export interface Pong {
	type: "pong";
	msg_id: string;
	agent_card: AgentCard;
}

/** Persisted agent entry in the per-project registry file. */
export interface RegistryEntry {
	session_id: string;
	name: string;
	purpose: string;
	model: string;
	color: string;
	pid: number;
	endpoint: string;
	cwd: string;
	started_at: string;
	explicit: boolean;
	version: number;
	context_used_pct?: number;
	queue_depth?: number;
	heartbeat_at?: string;
}

/** Pending outbound request waiting for a response from a peer. */
export interface PendingReply {
	resolve: (value: any) => void;
	reject: (err: Error) => void;
	timer: NodeJS.Timeout | null;
	promise: Promise<{ response?: any; error?: string | null }>;
	result?: { response?: any; error?: string | null };
	target_name?: string;
	created_at: string;
}

/** Inbound request context while a prompt is being processed locally. */
export interface InboundContext {
	msg_id: string;
	hops: number;
	sender_endpoint: string;
	sender_session: string;
	response_schema?: object | null;
	fulfilled: boolean;
}

/** CLI flags parsed from the Pi extension API for coms configuration. */
export interface CliFlags {
	name?: string;
	purpose?: string;
	project?: string;
	color?: string;
	explicit?: boolean;
}

/** Identity of the local coms agent for the current session. */
export interface ComsIdentity {
	session_id: string;
	name: string;
	purpose: string;
	color: string;
	project: string;
	explicit: boolean;
	cwd: string;
	model: string;
	endpoint: string;
	registryFile: string;
}

/** Agent card enriched with a stale-penalty counter for the pool widget. */
export type PeerCard = AgentCard & { staleCount: number };
