# Agent bootstrap (Pi Composer Powerpack)

Read this before picking work. Rules live in [AGENTS.md](../../AGENTS.md). Issue queue: [issue-tracker.md](issue-tracker.md). Domain: [domain.md](domain.md).

## Canonical surface

| What | Value |
|------|-------|
| **Repo** | `/Users/user/Projects/pi-composer-powerpack` |
| **Branch** | `main` |
| **GitHub** | https://github.com/kartikkabadi/pi-composer-powerpack |

## Do not use

| Path | Why |
|------|-----|
| `/Users/user/Documents/projects/archive/pi-composer-powerpack-stale-v0.1.0-2026-05` | Stale v0.1.0 snapshot — do not develop or `pi install` from there |

## Read order

1. [README.md](../../README.md) — install and user commands
2. [docs/architecture.md](../architecture.md) — extension tiers, config cascade
3. [docs/CONTEXT.md](../CONTEXT.md) — glossary
4. [docs/ROADMAP.md](../ROADMAP.md) — shipped vs next vs non-goals

## Verify before claiming done

```bash
npm run check:secrets
npm run pack:dry
npm run lint
npm run typecheck
npm test   # expect 58 pass
```

Optional: isolated `pi install https://github.com/kartikkabadi/pi-composer-powerpack` smoke.

## Last verified

2026-05-25 — tests 58/58 pass on `main`; GitHub release [v0.2.15](https://github.com/kartikkabadi/pi-composer-powerpack/releases/tag/v0.2.15).

## Scope

Guide/assets package only — **no** `install.sh`, second npm setup path, or architecture refactor unless Kartik asks.

## Maintainer overlay

On Kartik's machines only: [AGENTS.maintainer.md](../../AGENTS.maintainer.md) (private skills, release notes).
