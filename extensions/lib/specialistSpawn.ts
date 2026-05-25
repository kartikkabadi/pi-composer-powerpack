/**
 * specialistSpawn — Thin re-export from childAgentSession for backward compat.
 *
 * All new callers should import from childAgentSession.ts directly.
 * This module exists so existing imports continue to work.
 */

export {
	spawnChildAgent as runSpecialistSpawn,
	type ChildAgentOptions as SpecialistSpawnOptions,
	type ChildAgentHandlers as SpecialistSpawnHandlers,
	type ChildAgentResult as SpecialistSpawnResult,
} from "./childAgentSession.ts";
