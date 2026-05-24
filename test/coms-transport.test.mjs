import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as net from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let sendEnvelope;
let setNetHooksForTests;
let resetNetHooksForTests;
let sockDir;

before(async () => {
	({ sendEnvelope, setNetHooksForTests, resetNetHooksForTests } = await import(
		join(repoRoot, "extensions", "coms", "transport.ts")
	));
	sockDir = mkdtempSync(join(tmpdir(), "coms-transport-test-"));
});

after(() => {
	resetNetHooksForTests();
	try { rmSync(sockDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

test("sendEnvelope receives pong from mock peer", async () => {
	const endpoint = join(sockDir, "peer.sock");
	const server = net.createServer((socket) => {
		let buf = "";
		socket.on("data", (chunk) => {
			buf += chunk.toString("utf-8");
			const nl = buf.indexOf("\n");
			if (nl < 0) return;
			const line = buf.slice(0, nl);
			const env = JSON.parse(line);
			assert.equal(env.type, "ping");
			socket.write(JSON.stringify({
				type: "pong",
				msg_id: env.msg_id,
				agent_card: {
					name: "mock-peer",
					purpose: "test",
					model: "test-model",
					color: "#36F9F6",
					context_used_pct: 42,
					queue_depth: 0,
				},
			}) + "\n");
			socket.end();
		});
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(endpoint, resolve);
	});

	const reply = await sendEnvelope(endpoint, {
		type: "ping",
		msg_id: "01TESTMSG0000000000000000",
		sender_session: "sender",
		sender_endpoint: "/dev/null",
		hops: 0,
		timestamp: new Date().toISOString(),
	});

	assert.equal(reply.type, "pong");
	assert.equal(reply.agent_card.name, "mock-peer");
	assert.equal(reply.agent_card.context_used_pct, 42);

	await new Promise((resolve) => server.close(resolve));
});

test("sendEnvelope rejects nack responses", async () => {
	const endpoint = join(sockDir, "nack.sock");
	const server = net.createServer((socket) => {
		let buf = "";
		socket.on("data", (chunk) => {
			buf += chunk.toString("utf-8");
			if (buf.includes("\n")) {
				socket.write(JSON.stringify({ type: "nack", error: "rejected" }) + "\n");
				socket.end();
			}
		});
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(endpoint, resolve);
	});

	await assert.rejects(
		sendEnvelope(endpoint, {
			type: "ping",
			msg_id: "01TESTMSG0000000000000001",
			sender_session: "s",
			sender_endpoint: "/dev/null",
			hops: 0,
			timestamp: new Date().toISOString(),
		}),
		/rejected/,
	);

	await new Promise((resolve) => server.close(resolve));
});

test("injectable createConnection can be swapped for tests", async () => {
	const fakeEndpoint = join(sockDir, "injected.sock");
	let connectCalls = 0;

	setNetHooksForTests({
		createConnection: (opts) => {
			connectCalls++;
			return net.createConnection(opts);
		},
		createServer: net.createServer,
	});

	const server = net.createServer((socket) => {
		socket.on("data", () => {
			socket.write(JSON.stringify({ type: "ack", msg_id: "x" }) + "\n");
			socket.end();
		});
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(fakeEndpoint, resolve);
	});

	const reply = await sendEnvelope(fakeEndpoint, {
		type: "ping",
		msg_id: "01TESTMSG0000000000000002",
		sender_session: "s",
		sender_endpoint: "/dev/null",
		hops: 0,
		timestamp: new Date().toISOString(),
	});
	assert.equal(reply.type, "ack");
	assert.ok(connectCalls >= 1);

	resetNetHooksForTests();
	await new Promise((resolve) => server.close(resolve));
});
