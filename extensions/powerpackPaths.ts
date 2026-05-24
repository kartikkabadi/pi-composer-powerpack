import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function powerpackRoot(fileUrl: string): string {
	return dirname(dirname(fileURLToPath(fileUrl)));
}

export function powerpackPath(fileUrl: string, ...parts: string[]): string {
	return join(powerpackRoot(fileUrl), ...parts);
}

export function powerpackAgentsDir(fileUrl: string): string {
	return powerpackPath(fileUrl, "agents");
}

export function powerpackCursorSdkExtension(fileUrl: string): string {
	return powerpackPath(fileUrl, "extensions", "cursor-sdk.ts");
}

export function piAgentHome(): string {
	return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

export function resolvePiBinary(): string {
	const configured = process.env.PI_POWERPACK_PI || process.env.PI_BIN;
	if (configured) return configured;

	const localPi = join(homedir(), ".local", "bin", "pi");
	return existsSync(localPi) ? localPi : "pi";
}

/** When PI_POWERPACK_PI points at a .mjs/.js script, spawn via node. */
export function resolvePiSpawn(): { command: string; prefixArgs: string[] } {
	const configured = process.env.PI_POWERPACK_PI || process.env.PI_BIN;
	if (configured && (configured.endsWith(".mjs") || configured.endsWith(".js"))) {
		return { command: process.execPath, prefixArgs: [configured] };
	}
	return { command: resolvePiBinary(), prefixArgs: [] };
}
