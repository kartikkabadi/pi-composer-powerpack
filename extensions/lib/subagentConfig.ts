import {
	powerpackCursorSdkExtension,
	powerpackPath,
	piAgentHome,
} from "../powerpackPaths.ts";

export { piAgentHome };

export function getCursorModel(): string {
	return process.env.PI_SUBAGENT_MODEL || "cursor/composer-2.5";
}

export function getCursorFastFlags(): string[] {
	return process.env.PI_SUBAGENT_CURSOR_FAST === "0" ? [] : ["--cursor-fast"];
}

export function getCursorSdkExtensionPath(callerUrl: string): string {
	return process.env.PI_CURSOR_SDK_EXTENSION || powerpackCursorSdkExtension(callerUrl);
}

export function getDamageControlExtensionPath(callerUrl: string): string {
	return (
		process.env.PI_DAMAGE_CONTROL_EXTENSION ||
		powerpackPath(callerUrl, "extensions", "damage-control-continue.ts")
	);
}

export function shouldLoadChildDamageControl(): boolean {
	return process.env.PI_SUBAGENT_DAMAGE_CONTROL !== "0";
}

export type PiChildOptions = {
	task: string;
	tools: string;
	systemPrompt?: string;
	sessionFile?: string;
	continueSession?: boolean;
	ephemeral?: boolean;
	includeDamageControl?: boolean;
};

export function buildChildPiArgv(callerUrl: string, opts: PiChildOptions): string[] {
	const includeDc = opts.includeDamageControl ?? shouldLoadChildDamageControl();
	const args = [
		"--mode",
		"json",
		"-p",
		"--no-extensions",
		"--extension",
		getCursorSdkExtensionPath(callerUrl),
	];

	if (includeDc) {
		args.push("--extension", getDamageControlExtensionPath(callerUrl));
	}

	args.push(...getCursorFastFlags());
	args.push("--model", getCursorModel());
	args.push("--tools", opts.tools);
	args.push("--thinking", "off");

	if (opts.systemPrompt) {
		args.push("--append-system-prompt", opts.systemPrompt);
	}

	if (opts.ephemeral) {
		args.push("--no-session");
	} else if (opts.sessionFile) {
		args.push("--session", opts.sessionFile);
		if (opts.continueSession) {
			args.push("-c");
		}
	}

	args.push(opts.task);
	return args;
}
