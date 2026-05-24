/**
 * subagentConfig — Thin re-export from childAgentSession for backward compat.
 *
 * All new callers should import from childAgentSession.ts directly.
 */

export {
	piAgentHome,
	getCursorModel,
	getCursorFastFlags,
	getCursorSdkExtensionPath,
	getDamageControlExtensionPath,
	shouldLoadChildDamageControl,
	buildChildPiArgv,
	type ChildAgentOptions as PiChildOptions,
} from "./childAgentSession.ts";
