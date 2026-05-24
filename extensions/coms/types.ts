import * as os from "node:os";
import * as path from "node:path";

export const COMS_DIR = process.env.PI_COMS_DIR || path.join(os.homedir(), ".pi", "coms");
export const MAX_HOPS = Number(process.env.PI_COMS_MAX_HOPS) || 5;
export const TIMEOUT_MS = Number(process.env.PI_COMS_TIMEOUT_MS) || 1_800_000;
export const ACK_TIMEOUT_MS = Number(process.env.PI_COMS_ACK_TIMEOUT_MS) || 15_000;
export const PING_INTERVAL_MS = Number(process.env.PI_COMS_PING_INTERVAL_MS) || 10_000;
export const KEEPALIVE_INTERVAL_MS = 30_000;
export const LINE_CAP_BYTES = 64 * 1024;

export const FALLBACK_PALETTE = [
	"#72F1B8", "#36F9F6", "#FF7EDB", "#FEDE5D",
	"#C792EA", "#FF8B39", "#4D9DE0", "#FFAA8B",
];

export type EnvelopeType = "prompt" | "response" | "ping";

export interface Envelope {
	type: EnvelopeType;
	msg_id: string;
	sender_session: string;
	sender_endpoint: string;
	hops: number;
	timestamp: string;
}

export interface PromptEnvelope extends Envelope {
	type: "prompt";
	prompt: string;
	sender_name: string;
	sender_cwd: string;
	conversation_id?: string | null;
	response_schema?: object | null;
}

export interface ResponseEnvelope extends Envelope {
	type: "response";
	response: any;
	error?: string | null;
}

export interface PingEnvelope extends Envelope {
	type: "ping";
}

export interface AgentCard {
	name: string;
	purpose: string;
	model: string;
	color: string;
	context_used_pct: number;
	queue_depth: number;
}

export interface Pong {
	type: "pong";
	msg_id: string;
	agent_card: AgentCard;
}

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

export interface PendingReply {
	resolve: (value: any) => void;
	reject: (err: Error) => void;
	timer: NodeJS.Timeout | null;
	promise: Promise<{ response?: any; error?: string | null }>;
	result?: { response?: any; error?: string | null };
	target_name?: string;
	created_at: string;
}

export interface InboundContext {
	msg_id: string;
	hops: number;
	sender_endpoint: string;
	sender_session: string;
	response_schema?: object | null;
	fulfilled: boolean;
}

export interface CliFlags {
	name?: string;
	purpose?: string;
	project?: string;
	color?: string;
	explicit?: boolean;
}

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

export type PeerCard = AgentCard & { staleCount: number };
