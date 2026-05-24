#!/usr/bin/env node
/**
 * Stub Pi binary for harness tests — emits canned NDJSON on stdout.
 * Echoes argv diagnostics to stderr for assertions.
 */

const args = process.argv.slice(2);

function hasFlag(flag) {
	return args.includes(flag);
}

function flagValue(flag) {
	const idx = args.indexOf(flag);
	return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function extensionCount() {
	let count = 0;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--extension") count++;
	}
	return count;
}

const diagnostics = {
	mode: flagValue("--mode"),
	tools: flagValue("--tools"),
	systemPrompt: flagValue("--append-system-prompt"),
	noSession: hasFlag("--no-session"),
	session: flagValue("--session"),
	continueSession: hasFlag("-c"),
	extensionCount: extensionCount(),
	task: args.at(-1),
};

process.stderr.write(`stub-pi: ${JSON.stringify(diagnostics)}\n`);

if (diagnostics.mode === "json" && hasFlag("-p")) {
	const chunks = ["Hello", " from", " stub-pi"];
	let full = "";
	for (const chunk of chunks) {
		full += chunk;
		process.stdout.write(
			JSON.stringify({
				type: "message_update",
				assistantMessageEvent: { type: "text_delta", delta: chunk },
			}) + "\n",
		);
	}
	process.stdout.write(JSON.stringify({ type: "agent_end", messages: [] }) + "\n");
	process.exit(0);
}

process.stderr.write("stub-pi: unsupported invocation\n");
process.exit(2);
