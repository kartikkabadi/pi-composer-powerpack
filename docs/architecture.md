# Architecture

Pi Composer Powerpack is a **Pi package** (`package.json` → `pi.extensions`), not a VS Code or Cursor IDE extension.

## Install flow

End-user steps: [README Quick start (install)](../README.md#install).

```text
pi install https://github.com/kartikkabadi/pi-composer-powerpack
        │
        ▼
package.json pi.extensions (7 TypeScript modules)
        │
        ├── cursor-sdk ──────────► pi-cursor-sdk (Cursor provider)
        ├── damage-control-continue ► config/damage-control-rules.yaml
        ├── subagent-widget
        ├── coms
        ├── agent-chain (dormant until /chain-mode)
        ├── agent-team (dormant until /agents-mode)
        └── pi-pi (dormant until /pi-pi-mode)
```

Bundled markdown/YAML under `agents/` and `themes/` are copied into the Pi package install path. Project overrides may live in `.pi/agents/`.

## Extension tiers

| Tier | Extensions | Activation |
|------|------------|------------|
| Provider | `cursor-sdk` | Always |
| Safety / UI | `damage-control-continue`, `subagent-widget`, `coms` | Always |
| Workflows | `agent-chain`, `agent-team`, `pi-pi` | Slash commands |
| Opt-in (repo only) | `tilldone`, `auto-caveman`, `superset-hooks` | Manual `-e ./extensions/...` |

## Dormant workflow modes

`agent-chain`, `agent-team`, and `pi-pi` register on every session but stay passive until activated:

- **Chain:** `/chain-mode` sets active tools to `run_chain` only; `/direct` restores full tools.
- **Team:** `/agents-mode` sets `dispatch_agent` only; `/agents-off` restores full tools.
- **Pi-Pi:** `/pi-pi-mode` loads orchestrator system prompt; `/pi-pi-off` leaves expert mode.

This avoids fighting the default coding session while keeping commands discoverable.

## Shared helpers

- [`extensions/powerpackPaths.ts`](../extensions/powerpackPaths.ts) — resolve package root, agents dir, cursor-sdk path, `pi` binary
- [`extensions/themeMap.ts`](../extensions/themeMap.ts) — per-extension terminal title; theme map metadata (theme switch is a no-op until Pi exposes an API)

## Config cascade (agent precedence)

Agent definitions, chains, teams, and experts are loaded from multiple layers. Later sources override earlier ones for same-name entries.

| Data | Loader | Collision rule | Priority (highest → lowest) |
|------|--------|----------------|----------------------------|
| Agents | `scanAgents` | First-seen wins | Project `.pi/agents` → global `~/.pi/agent/agents` → package `agents/` |
| Pi-Pi experts | `loadPiPiExperts` | Last-wins overlay | Package → global → project (project replaces earlier) |
| Chains | `mergeChains` | Last-wins overlay | Package → global → project |
| Teams | `mergeTeams` | Last-wins overlay | Package → global → project |

Both collision strategies result in **project > global > package** priority, just via different mechanisms (scan order + first-seen vs overlay + last-wins).

See [ADR-0001](adr/0001-agent-precedence.md) for rationale and [CONTEXT.md](CONTEXT.md) for glossary.

## Subprocess model

Chain and team modes spawn child `pi` processes for specialist agents, using bundled agent markdown and session files under `.pi/agent-sessions/`. Coms uses Unix domain sockets under `~/.pi/coms` (configurable via `PI_COMS_DIR`).
