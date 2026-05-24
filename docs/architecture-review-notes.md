# Architecture review notes (Phase B baseline)

Short findings before v0.2.1–v0.2.14 publish train.

## Strengths

- **Pi package model** is clear: `package.json` → `pi.extensions`, GitHub install only, no parallel install scripts.
- **Subprocess spine** (`subagentConfig`, `piJsonSubprocess`) centralizes child `pi` argv, Cursor SDK, and damage-control defaults.
- **Agent discovery** (`agentDefinitions`) already unifies markdown agents, teams, and chains for chain/team modes.
- **Coms split** (protocol, registry, transport, tools, widget) separates transport from session lifecycle.

## Gaps addressed in Phase B

| Area | Issue | Target |
|------|--------|--------|
| Damage-control | Raw secrets in block reasons / confirm UI | `redactInvocation` everywhere user-visible |
| Paths | Duplicate `PI_AGENT_HOME` / `getPiAgentHome` | Canonical `piAgentHome()` |
| Frontmatter | Duplicated `---` parsers | `extensions/lib/frontmatter.ts` |
| Spawns | Direct `spawnPiJsonProcess` in widgets | `runSpecialistSpawn` wrapper |
| Coms | Large `index.ts`, duplicated line read / ping | `runtime.ts`, `readOneLineCapped`, unified ping |
| Workflow UIs | Copy-pasted grid layout in pi-pi / team / chain | `workflowGrid.ts` |
| Rules engine | Monolithic `tool_call` handler | `damageControlRules.evaluateToolCall` + tests |
| CI | Unprotected `pnpm install` on main | Socket `action@v1.3.1` + `sfw` |

## LOC / module boundaries

- Keep extension entry files **≤450 LOC** where plan specifies; push grid/runtime/helpers into `extensions/lib/` or `extensions/coms/`.
- `cursor-sdk.ts` stays excluded from strict TS lint by convention.

## Risk notes

- **Child DC default on** (since v0.2.0): subprocess tests must keep covering opt-out via `PI_SUBAGENT_DAMAGE_CONTROL=0`.
- **Coms sockets**: stale-socket probe + line cap are security-relevant; transport tests are the regression gate.
- **Sequential tags**: each release pushes `main`; no force-push; changelog section must match tag version.
