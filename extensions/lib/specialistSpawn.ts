import type { ChildProcess } from "node:child_process";
import { spawnPiJsonProcess, type PiJsonHandlers, type PiJsonRunResult } from "./piJsonSubprocess.ts";
import type { PiChildOptions } from "./subagentConfig.ts";

export type SpecialistSpawnOptions = PiChildOptions;

export type SpecialistSpawnHandlers = PiJsonHandlers;

export type SpecialistSpawnResult = PiJsonRunResult & {
	proc?: ChildProcess;
};

/**
 * Canonical wrapper for specialist / subagent Pi JSON subprocess spawns.
 */
export function runSpecialistSpawn(
	callerUrl: string,
	opts: SpecialistSpawnOptions,
	handlers: SpecialistSpawnHandlers = {},
): Promise<SpecialistSpawnResult> {
	let proc: ChildProcess | undefined;
	return spawnPiJsonProcess(callerUrl, opts, {
		...handlers,
		onSpawn: (child) => {
			proc = child;
			handlers.onSpawn?.(child);
		},
	}).then((result) => ({ ...result, proc }));
}
