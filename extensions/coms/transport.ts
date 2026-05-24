import * as net from "node:net";
import * as fs from "node:fs";
import { ACK_TIMEOUT_MS, LINE_CAP_BYTES, type Envelope, type Pong } from "./types.ts";

export type CreateConnectionFn = (options: net.NetConnectOpts) => net.Socket;
export type CreateServerFn = (connectionListener?: (socket: net.Socket) => void) => net.Server;

export interface NetHooks {
	createConnection: CreateConnectionFn;
	createServer: CreateServerFn;
}

const defaultNet: NetHooks = {
	createConnection: (options) => net.createConnection(options),
	createServer: (connectionListener) => net.createServer(connectionListener),
};

let netHooks: NetHooks = defaultNet;

/** Test-only: inject mock net.createConnection / createServer. */
export function setNetHooksForTests(hooks: Partial<NetHooks>): void {
	netHooks = { ...defaultNet, ...hooks };
}

/** Test-only: restore default net hooks. */
export function resetNetHooksForTests(): void {
	netHooks = defaultNet;
}

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

export async function bindEndpoint(
	endpoint: string,
	connHandler: (socket: net.Socket) => void,
): Promise<net.Server> {
	if (process.platform !== "win32" && fs.existsSync(endpoint)) {
		const verdict = await probeStaleSocket(endpoint);
		if (verdict === "in_use") {
			throw new Error(`coms: endpoint already in use (${endpoint})`);
		}
		try {
			fs.unlinkSync(endpoint);
		} catch {
			// best-effort
		}
	}
	return await new Promise<net.Server>((resolve, reject) => {
		const server = netHooks.createServer(connHandler);
		server.once("error", reject);
		server.listen(endpoint, () => {
			server.removeListener("error", reject);
			resolve(server);
		});
	});
}

export function readOneLine(socket: net.Socket): Promise<string> {
	return new Promise((resolve, reject) => {
		let buf = "";
		let settled = false;
		const onData = (chunk: Buffer) => {
			buf += chunk.toString("utf-8");
			if (buf.length > LINE_CAP_BYTES) {
				if (settled) return;
				settled = true;
				socket.removeListener("data", onData);
				reject(new Error("line too large"));
				return;
			}
			const nl = buf.indexOf("\n");
			if (nl >= 0) {
				if (settled) return;
				settled = true;
				socket.removeListener("data", onData);
				resolve(buf.slice(0, nl));
			}
		};
		socket.on("data", onData);
		socket.once("error", (err) => {
			if (settled) return;
			settled = true;
			reject(err);
		});
		socket.once("close", () => {
			if (settled) return;
			settled = true;
			reject(new Error("connection closed before line received"));
		});
	});
}

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
