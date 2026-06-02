import { createConnection, createServer, type NetConnectOpts, type Server, type Socket } from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import { ACK_TIMEOUT_MS, LINE_CAP_BYTES, type Envelope, type Pong } from "./types.ts";

/** Factory function type for creating a net.Socket connection. */
export type CreateConnectionFn = (options: NetConnectOpts) => Socket;
/** Factory function type for creating a net.Server. */
export type CreateServerFn = (connectionListener?: (socket: Socket) => void) => Server;

/** Injectable net dependencies used for testing or mocking socket operations. */
export interface NetHooks {
	createConnection: CreateConnectionFn;
	createServer: CreateServerFn;
}

const defaultNet: NetHooks = {
	createConnection: (options) => createConnection(options),
	createServer: (connectionListener) => createServer(connectionListener),
};

let netHooks: NetHooks = defaultNet;

/** Test-only: inject mock createConnection / createServer. */
export function setNetHooksForTests(hooks: Partial<NetHooks>): void {
	netHooks = { ...defaultNet, ...hooks };
}

/** Test-only: restore default net hooks. */
export function resetNetHooksForTests(): void {
	netHooks = defaultNet;
}

/**
 * Probe whether an existing socket endpoint is actively in use or stale.
 *
 * @param endpoint - The socket endpoint to probe
 * @returns "in_use" if connected, "stale" if unreachable
 */
export function probeStaleSocket(endpoint: string): Promise<"in_use" | "stale"> {
	return new Promise((resolve) => {
		const sock = netHooks.createConnection({ path: endpoint });
		let settled = false;
		const finish = (verdict: "in_use" | "stale") => {
			if (settled) return;
			settled = true;
			try { sock.destroy(); } catch { /* ignore */ }
			resolve(verdict);
		};
		const timer = setTimeout(() => finish("stale"), 250);
		sock.once("connect", () => {
			clearTimeout(timer);
			finish("in_use");
		});
		sock.once("error", (err: any) => {
			clearTimeout(timer);
			if (err && err.code === "ECONNREFUSED") {
				finish("stale");
			} else {
				finish("stale");
			}
		});
	});
}

/**
 * Bind a unix socket or named pipe endpoint.
 *
 * Cleans up stale sockets first, then binds the endpoint.
 *
 * @param endpoint - The socket endpoint to bind
 * @param connHandler - Connection handler for incoming sockets
 * @returns The bound server instance
 */
export async function bindEndpoint(
	endpoint: string,
	connHandler: (socket: Socket) => void,
): Promise<Server> {
	if (process.platform !== "win32" && existsSync(endpoint)) {
		const verdict = await probeStaleSocket(endpoint);
		if (verdict === "in_use") {
			throw new Error(`coms: endpoint already in use (${endpoint})`);
		}
		try {
			unlinkSync(endpoint);
		} catch {
			// best-effort
		}
	}
	return await new Promise<Server>((resolve, reject) => {
		const server = netHooks.createServer(connHandler);
		server.once("error", reject);
		server.listen(endpoint, () => {
			server.removeListener("error", reject);
			resolve(server);
		});
	});
}

/**
 * Send an envelope to a peer endpoint.
 *
 * @param endpoint - The target socket endpoint
 * @param envelope - The envelope to send
 * @returns The parsed Pong response, or null on error
 */
export async function sendEnvelope(
	endpoint: string,
	envelope: Envelope,
): Promise<Pong | null> {
	return new Promise((resolve) => {
		const sock = netHooks.createConnection({ path: endpoint });
		let settled = false;
		const finish = (result: Pong | null) => {
			if (settled) return;
			settled = true;
			try { sock.destroy(); } catch { /* ignore */ }
			resolve(result);
		};

		const timer = setTimeout(() => finish(null), ACK_TIMEOUT_MS);
		sock.once("connect", () => {
			const line = JSON.stringify(envelope) + "\n";
			sock.write(line);
			let buf = "";
			sock.on("data", (chunk: Buffer) => {
				buf += chunk.toString();
				const nl = buf.indexOf("\n");
				if (nl >= 0) {
					clearTimeout(timer);
					try {
						const parsed = JSON.parse(buf.slice(0, nl)) as Pong;
						finish(parsed);
					} catch {
						finish(null);
					}
				}
			});
		});
		sock.once("error", () => {
			clearTimeout(timer);
			finish(null);
		});
	});
}

const defaultNet: NetHooks = {
	createConnection: (options) => createConnection(options),
	createServer: (connectionListener) => createServer(connectionListener),
};

let netHooks: NetHooks = defaultNet;

/** Test-only: inject mock createConnection / createServer. */
export function setNetHooksForTests(hooks: Partial<NetHooks>): void {
	netHooks = { ...defaultNet, ...hooks };
}

/** Test-only: restore default net hooks. */
export function resetNetHooksForTests(): void {
	netHooks = defaultNet;
}

/** Probe whether an existing socket endpoint is actively in use or stale (unreachable). */
export function probeStaleSocket(endpoint: string): Promise<"in_use" | "stale"> {
	return new Promise((resolve) => {
		const sock = netHooks.createConnection({ path: endpoint });
		let settled = false;
		const finish = (verdict: "in_use" | "stale") => {
			if (settled) return;
			settled = true;
			try { sock.destroy(); } catch { /* ignore */ }
			resolve(verdict);
		};
		const timer = setTimeout(() => finish("stale"), 250);
		sock.once("connect", () => {
			clearTimeout(timer);
			finish("in_use");
		});
		sock.once("error", (err: any) => {
			clearTimeout(timer);
			if (err && err.code === "ECONNREFUSED") {
				finish("stale");
			} else {
				finish("stale");
			}
		});
	});
}

/** Bind a unix socket or named pipe endpoint, cleaning up stale sockets first. */
export async function bindEndpoint(
	endpoint: string,
	connHandler: (socket: Socket) => void,
): Promise<Server> {
	if (process.platform !== "win32" && existsSync(endpoint)) {
		const verdict = await probeStaleSocket(endpoint);
		if (verdict === "in_use") {
			throw new Error(`coms: endpoint already in use (${endpoint})`);
		}
		try {
			unlinkSync(endpoint);
		} catch {
			// best-effort
		}
	}
	return await new Promise<Server>((resolve, reject) => {
		const server = netHooks.createServer(connHandler);
		server.once("error", reject);
		server.listen(endpoint, () => {
			server.removeListener("error", reject);
			resolve(server);
		});
	});
}

/** Read exactly one newline-terminated line from a socket, rejecting if it exceeds maxBytes. */
export function readOneLineCapped(socket: Socket, maxBytes = LINE_CAP_BYTES): Promise<string> {
	return new Promise((resolve, reject) => {
		let buf = "";
		let settled = false;
		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			socket.removeListener("data", onData);
			fn();
		};
		const onData = (chunk: Buffer) => {
			buf += chunk.toString("utf-8");
			if (buf.length > maxBytes) {
				finish(() => reject(new Error("line too large")));
				return;
			}
			const nl = buf.indexOf("\n");
			if (nl >= 0) {
				finish(() => resolve(buf.slice(0, nl)));
			}
		};
		socket.on("data", onData);
		socket.once("error", (err) => finish(() => reject(err)));
		socket.once("close", () =>
			finish(() => reject(new Error("connection closed before line received"))),
		);
	});
}

/** Read one line from a socket using the default line cap. */
export function readOneLine(socket: Socket): Promise<string> {
	return readOneLineCapped(socket, LINE_CAP_BYTES);
}

/** Send an envelope over a unix socket and wait for the ack/nack reply. Rejects on nack or timeout. */
export function sendEnvelope(
	endpoint: string,
	envelope: Envelope | Pong | { type: string; msg_id?: string; [k: string]: any },
	timeoutMs = ACK_TIMEOUT_MS,
): Promise<any> {
	return new Promise((resolve, reject) => {
		const sock = netHooks.createConnection({ path: endpoint });
		let settled = false;
		let timer: NodeJS.Timeout | null = null;
		const fail = (err: Error) => {
			if (settled) return;
			settled = true;
			if (timer) {
				try { clearTimeout(timer); } catch { /* ignore */ }
				timer = null;
			}
			try { sock.destroy(); } catch { /* ignore */ }
			reject(err);
		};
		timer = setTimeout(() => fail(new Error(`ack timeout after ${timeoutMs}ms`)), timeoutMs);
		try { (timer as any).unref?.(); } catch { /* ignore */ }
		sock.once("error", fail);
		sock.once("connect", async () => {
			try {
				sock.write(JSON.stringify(envelope) + "\n");
				const line = await readOneLine(sock);
				const parsed = JSON.parse(line);
				try { sock.end(); } catch { /* ignore */ }
				if (settled) return;
				settled = true;
				if (timer) {
					try { clearTimeout(timer); } catch { /* ignore */ }
					timer = null;
				}
				if (parsed && parsed.type === "nack") {
					reject(new Error(parsed.error || "nack"));
				} else {
					resolve(parsed);
				}
			} catch (err) {
				fail(err instanceof Error ? err : new Error(String(err)));
			}
		});
	});
}
