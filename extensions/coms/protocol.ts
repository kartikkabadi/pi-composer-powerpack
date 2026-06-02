import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdownFrontmatter } from "../lib/frontmatter.ts";
import { COMS_DIR, FALLBACK_PALETTE, type CliFlags, type Envelope, type PingEnvelope } from "./types.ts";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Generate a 26-character Crockford Base32 ULID.
 *
 * Uses current time + random bytes for uniqueness.
 *
 * @returns A 26-character ULID string
 */
export function ulid(): string {
	const time = Date.now();
	const rand = randomBytes(10);
	let timeStr = "";
	let t = time;
	for (let i = 9; i >= 0; i--) {
		timeStr = CROCKFORD[t % 32] + timeStr;
		t = Math.floor(t / 32);
	}
	let randStr = "";
	let bits = 0;
	let value = 0;
	for (const byte of rand) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			randStr += CROCKFORD[(value >> bits) & 31];
		}
	}
	return (timeStr + randStr).slice(0, 26);
}

/**
 * Wrap a string in ANSI 24-bit foreground color escape codes.
 *
 * @param hex - The #RRGGBB hex color value
 * @param s - The string to wrap
 * @returns The string wrapped in ANSI color codes
 */
export function hexFg(hex: string, s: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
}

/**
 * Validate a hex color string.
 *
 * @param hex - The hex color string to validate
 * @returns true if valid 7-character #RRGGBB hex color
 */
export function isValidHex(hex: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/**
 * Derive a deterministic fallback color from a session ID.
 *
 * Uses SHA-256 hash of the session ID to select a color from the palette.
 *
 * @param sessionId - The session ID to derive color from
 * @returns A hex color string from the fallback palette
 */
export function fallbackColor(sessionId: string): string {
	const h = createHash("sha256").update(sessionId).digest("hex").slice(0, 8);
	return FALLBACK_PALETTE[Number(BigInt("0x" + h)) % FALLBACK_PALETTE.length];
}

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * @param raw - Raw markdown string with YAML frontmatter
 * @returns Parsed frontmatter with name, description, color, and body
 */
export function parseFrontmatter(raw: string): { name?: string; description?: string; color?: string; body: string } {
	const { fields, body } = parseMarkdownFrontmatter(raw);
	return {
		name: fields.name,
		description: fields.description,
		color: fields.color,
		body,
	};
}

/**
 * Build a platform-appropriate endpoint path.
 *
 * Returns a unix socket path on POSIX or named pipe on Windows.
 *
 * @param sessionId - The session ID for the endpoint
 * @returns The endpoint path
 */
export function makeEndpoint(sessionId: string): string {
	if (process.platform === "win32") {
		return `\\\\.\\pipe\\pi-coms-${sessionId}`;
	}
	return join(COMS_DIR, "sockets", `${sessionId}.sock`);
}

/**
 * Return the current timestamp as an ISO-8601 string.
 *
 * @returns ISO-8601 formatted timestamp
 */
export function nowIso(): string {
	return new Date().toISOString();
}

/**
 * Create a ping envelope for peer discovery.
 *
 * @param sessionId - The sender's session ID
 * @param endpoint - The sender's endpoint
 * @returns A ping envelope
 */
export function makePingEnvelope(sessionId: string, endpoint: string): PingEnvelope {
	return {
		type: "ping",
		msg_id: ulid(),
		sender_session: sessionId,
		sender_endpoint: endpoint,
		hops: 0,
		timestamp: nowIso(),
	};
}

/**
 * Abbreviate a model name by stripping common prefixes.
 *
 * @param model - The model name to abbreviate
 * @returns Abbreviated model name
 */
export function abbreviateModel(model: string): string {
	return model.replace(/^claude-/, "").slice(0, 14);
}

/**
 * Validate an envelope object.
 *
 * @param obj - The object to validate
 * @returns true if the object is a valid envelope
 */
export function isValidEnvelope(obj: unknown): obj is Envelope {
	if (!obj || typeof obj !== "object") return false;
	const e = obj as Record<string, unknown>;
	return (
		typeof e.type === "string" &&
		typeof e.msg_id === "string" &&
		typeof e.sender_session === "string" &&
		typeof e.sender_endpoint === "string" &&
		typeof e.hops === "number" &&
		typeof e.timestamp === "string"
	);
}

/**
 * Find the system prompt path from command-line arguments.
 *
 * @param argv - The process arguments to search
 * @returns Path to the system prompt file, or null if not found
 */
export function findSystemPromptPath(argv: string[]): string | null {
	for (let i = 0; i < argv.length - 1; i++) {
		if (argv[i] === "--system-prompt" || argv[i] === "--append-system-prompt") {
			const path = argv[i + 1];
			if (path && path.endsWith(".md") && existsSync(path)) {
				return path;
			}
		}
	}
	return null;
}
	let randStr = "";
	let bits = 0;
	let value = 0;
	for (const byte of rand) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			randStr += CROCKFORD[(value >> bits) & 31];
		}
	}
	return (timeStr + randStr).slice(0, 26);
}

/** Wrap a string in ANSI 24-bit foreground color escape codes from a #RRGGBB hex value. */
export function hexFg(hex: string, s: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
}

/** Return true if the string is a valid 7-character #RRGGBB hex color. */
export function isValidHex(hex: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** Derive a deterministic fallback color from a session ID using SHA-256. */
export function fallbackColor(sessionId: string): string {
	const h = createHash("sha256").update(sessionId).digest("hex").slice(0, 8);
	return FALLBACK_PALETTE[Number(BigInt("0x" + h)) % FALLBACK_PALETTE.length];
}

/** Parse YAML frontmatter from a markdown string, extracting name, description, and color. */
export function parseFrontmatter(raw: string): { name?: string; description?: string; color?: string; body: string } {
	const { fields, body } = parseMarkdownFrontmatter(raw);
	return {
		name: fields.name,
		description: fields.description,
		color: fields.color,
		body,
	};
}

/** Build a platform-appropriate endpoint path (unix socket or named pipe) for a session. */
export function makeEndpoint(sessionId: string): string {
	if (process.platform === "win32") {
		return `\\\\.\\pipe\\pi-coms-${sessionId}`;
	}
	return join(COMS_DIR, "sockets", `${sessionId}.sock`);
}

/** Return the current timestamp as an ISO-8601 string. */
export function nowIso(): string {
	return new Date().toISOString();
}

/** Construct a ping envelope addressed from senderSession/senderEndpoint. */
export function makePingEnvelope(senderSession: string, senderEndpoint: string): PingEnvelope {
	return {
		type: "ping",
		msg_id: ulid(),
		sender_session: senderSession,
		sender_endpoint: senderEndpoint,
		hops: 0,
		timestamp: nowIso(),
	};
}

/** Shorten a model identifier: strip the "claude-" prefix and cap at 14 characters. */
export function abbreviateModel(model: string): string {
	let m = model || "";
	if (m.startsWith("claude-")) m = m.slice("claude-".length);
	if (m.length > 14) m = m.slice(0, 14);
	return m;
}

/** Read coms-related CLI flags (name, purpose, project, color, explicit) from the Pi extension API. */
export function readCliFlags(pi: ExtensionAPI): CliFlags {
	const name = pi.getFlag("name") as string | undefined;
	const purpose = pi.getFlag("purpose") as string | undefined;
	const project = pi.getFlag("project") as string | undefined;
	const color = pi.getFlag("color") as string | undefined;
	const explicit = pi.getFlag("explicit") as boolean | undefined;
	return {
		name: name && name.length > 0 ? name : undefined,
		purpose: purpose && purpose.length > 0 ? purpose : undefined,
		project: project && project.length > 0 ? project : undefined,
		color: color && color.length > 0 ? color : undefined,
		explicit: explicit === true,
	};
}

/** Return true if the parsed object has the required fields of a valid coms Envelope. */
export function isValidEnvelope(obj: any): obj is Envelope {
	return !!(
		obj &&
		typeof obj === "object" &&
		typeof obj.type === "string" &&
		typeof obj.msg_id === "string" &&
		typeof obj.sender_session === "string" &&
		typeof obj.sender_endpoint === "string"
	);
}

/** Search argv for --system-prompt or --append-system-prompt pointing to an existing .md file. */
export function findSystemPromptPath(argv: string[]): string | null {
	const scan = (flag: string): string | null => {
		for (let i = 0; i < argv.length; i++) {
			if (argv[i] === flag && i + 1 < argv.length) {
				const candidate = argv[i + 1];
				if (candidate.endsWith(".md")) {
					try {
						if (existsSync(candidate) && statSync(candidate).isFile()) {
							return candidate;
						}
					} catch {
						// fall through
					}
				}
			}
		}
		return null;
	};
	return scan("--system-prompt") ?? scan("--append-system-prompt");
}

/** Read frontmatter from the system prompt file found in argv, returning name/description/color. */
export function readFrontmatterFromArgv(argv: string[]): { name?: string; description?: string; color?: string } {
	const p = findSystemPromptPath(argv);
	if (!p) return {};
	try {
		const raw = readFileSync(p, "utf-8");
		const { name, description, color } = parseFrontmatter(raw);
		return { name, description, color };
	} catch {
		return {};
	}
}
