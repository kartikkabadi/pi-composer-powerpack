# ADR-0001: Agent Definition Precedence

**Status:** Accepted
**Date:** 2026-05-25
**Deciders:** @kartikkabadi

## Context

Agent definitions, chains, teams, and Pi-Pi experts can be defined at three layers: bundled package (`agents/`), global user directory (`~/.pi/agent/agents/`), and per-project (`.pi/agents/`). The system needs a clear, documented precedence order.

## Decision

### scanAgents (agent-chain, agent-team)

**First-seen wins.** Directories are scanned in order: project agents, `.claude/agents`, `.pi/agents`, package agents, global agents. The first definition matching a given `name` key (lowercased) is kept; later duplicates are silently ignored.

This means project definitions take priority over package and global, which is the intended override direction.

### loadPiPiExperts

**Last-wins overlay.** Directories are scanned: package `agents/pi-pi/`, global `~/.pi/agent/agents/pi-pi/`, project `.pi/agents/pi-pi/`. Each layer replaces earlier entries with the same key. Project overrides win.

### mergeChains / mergeTeams

**Last-wins overlay.** Later definitions with the same chain or team name replace earlier ones. This matches `loadPiPiExperts` semantics.

## Consequences

- `scanAgents` and `loadPiPiExperts` use opposite collision strategies (first-wins vs last-wins) but both result in project > global > package priority because of scan order differences.
- Documented in `docs/CONTEXT.md` and `docs/architecture.md`.
- Tests in `test/agent-scan.test.mjs` cover basic scanning; precedence collision tests added in Phase 2.
