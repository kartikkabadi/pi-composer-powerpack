import { spawn, type ChildProcess } from "node:child_process";
import { resolvePiSpawn } from "../powerpackPaths.ts";
import { buildChildPiArgv, type PiChildOptions } from "./subagentConfig.ts";

export type PiJsonEvent = {
	type: string;
	assistantMessageEvent?: { type?: string; delta?: string };
	message?: { usage?: { input?: number } };
	messages?: Array<{ role?: string; usage?: { input?: number } }>;
};

export type PiJsonHandlers = {
	onTextDelta?: (delta: string, fullText: string, lastLine: string) => void;
	onToolStart?: () => void;
	onMessageEnd?: (usage?: { input?: number }) => void;
	onAgentEnd?: (messages?: Array<{ role?: string; usage?: { input?: number } }>) => void;
	onTick?: (elapsedMs: number) => void;
	onParseError?: (line: string, error: unknown) => void;
	onSpawn?: (proc: ChildProcess) => void;
};

export type PiJsonRunResult = {
	output: string;
	exitCode: number;
	elapsed: number;
};

export function parsePiJsonLine(line: string): PiJsonEvent | null {
	const trimmed = line.trim();
	if (!trimmed) return null;
	try {
		return JSON.parse(trimmed) as PiJsonEvent;
	} catch {
		return null;
	}
}

export function processPiJsonEvent(
	event: PiJsonEvent,
	textChunks: string[],
	handlers: PiJsonHandlers,
): void {
	if (event.type === "message_update") {
		const delta = event.assistantMessageEvent;
		if (delta?.type === "text_delta") {
			textChunks.push(delta.delta || "");
			const full = textChunks.join("");
			const last = full.split("\n").filter((l) => l.trim()).pop() || "";
			handlers.onTextDelta?.(delta.delta || "", full, last);
		}
	} else if (event.type === "tool_execution_start") {
		handlers.onToolStart?.();
	} else if (event.type === "message_end") {
		handlers.onMessageEnd?.(event.message?.usage);
	} else if (event.type === "agent_end") {
		handlers.onAgentEnd?.(event.messages);
	}
}

export function spawnPiJsonProcess(
	callerUrl: string,
	opts: PiChildOptions,
	handlers: PiJsonHandlers = {},
): Promise<PiJsonRunResult> {
	const args = buildChildPiArgv(callerUrl, opts);
	const textChunks: string[] = [];
	const startTime = Date.now();

	return new Promise((resolve) => {
		let proc: ChildProcess;
		const { command, prefixArgs } = resolvePiSpawn();
		try {
		proc = spawn(command, [...prefixArgs, ...args], {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
		});
		handlers.onSpawn?.(proc);
		} catch (error) {
			resolve({
				output: `Error spawning agent: ${error instanceof Error ? error.message : String(error)}`,
				exitCode: 1,
				elapsed: 0,
			});
			return;
		}

		const timer = handlers.onTick
			? setInterval(() => handlers.onTick!(Date.now() - startTime), 1000)
			: undefined;

		let buffer = "";

		const handleLine = (line: string) => {
			const event = parsePiJsonLine(line);
			if (!event) {
				if (line.trim()) handlers.onParseError?.(line, new Error("invalid JSON"));
				return;
			}
			processPiJsonEvent(event, textChunks, handlers);
		};

		proc.stdout?.setEncoding("utf-8");
		proc.stdout?.on("data", (chunk: string) => {
			buffer += chunk;
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) handleLine(line);
		});

		proc.stderr?.setEncoding("utf-8");
		proc.stderr?.on("data", () => {});

		proc.on("close", (code) => {
			if (buffer.trim()) handleLine(buffer);
			if (timer) clearInterval(timer);
			const elapsed = Date.now() - startTime;
			resolve({ output: textChunks.join(""), exitCode: code ?? 1, elapsed });
		});

		proc.on("error", (err) => {
			if (timer) clearInterval(timer);
			resolve({
				output: `Error spawning agent: ${err.message}`,
				exitCode: 1,
				elapsed: Date.now() - startTime,
			});
		});
	});
}

export { buildChildPiArgv, type PiChildOptions };
