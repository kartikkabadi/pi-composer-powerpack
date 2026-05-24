# Domain Context — Pi Composer Powerpack

Glossary and key concepts for agents and contributors working in this repo.

## Terms

| Term | Meaning |
|------|---------|
| **Pi** | Terminal-native coding agent (`@earendil-works/pi-coding-agent`) |
| **Powerpack** | This package — orchestration, agents, themes, and safety extensions for Pi |
| **Extension** | A TypeScript module loaded via `pi.extensions` in `package.json` or `-e` flag |
| **Workflow mode** | Dormant extension that restricts tools on activation (`/chain-mode`, `/agents-mode`, `/pi-pi-mode`) |
| **Chain** | Sequential pipeline of agent steps defined in `agent-chain.yaml` |
| **Team** | Named group of agents for parallel dispatch defined in `teams.yaml` |
| **Pi-Pi** | Meta-agent that uses domain experts to research Pi documentation before building |
| **Expert** | Read-only research subprocess in Pi-Pi; markdown files in `agents/pi-pi/` |
| **Coms** | Peer-to-peer messaging layer between Pi agents on the same machine |
| **Damage control** | Tool-call guardrails that block or prompt on risky operations |
| **Specialist spawn** | Subprocess model for child Pi agents (`runSpecialistSpawn`) |
| **WorkflowKit** | Shared rendering helpers for status cards, footers, and grid layouts |
| **ChildAgentSession** | Unified spawn seam combining subprocess config and specialist spawn |
| **Config cascade** | Agent/chain/team definition precedence: package → global → project (last wins) |
| **themeMap** | Per-extension terminal title and theme metadata |

## Precedence (config cascade)

Agent definitions, chains, teams, and Pi-Pi experts follow a layered precedence:

1. **Package** (`agents/` in this repo) — baseline bundled definitions
2. **Global** (`~/.pi/agent/agents/`) — user-wide customisation
3. **Project** (`.pi/agents/`) — per-project overrides (wins on name collision)

For `scanAgents`: first-seen wins (package dirs scanned first, then global, then project — but project is listed last so a collision keeps the earlier definition). For `loadPiPiExperts`, `mergeChains`, and `mergeTeams`: later overlay replaces earlier on name match (last wins).

See [ADR-0001](adr/0001-agent-precedence.md) for the design decision.
