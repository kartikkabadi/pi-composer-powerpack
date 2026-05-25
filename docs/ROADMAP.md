# Roadmap

Public status for Pi Composer Powerpack. Install path remains **Pi GitHub installer only** — no `install.sh` or second npm setup.

## Shipped (v0.2.15 on `main`)

- WorkflowKit orchestration (`/chain-mode`, `/agents-mode`, `/pi-pi-mode`)
- Config cascade (repo → user → bundled defaults)
- Spawn seam for subagents and teams
- `pi-cursor-sdk` Composer 2.5 + `--cursor-fast`
- Damage-control rules, mono-black theme, curated agent library
- CI: secrets scan, pack dry-run, lint, typecheck, tests (58 pass)
- Post-merge `pi install` smoke on GitHub URL

## Next (optional, not blocking share)

- Tag **v0.2.15** on GitHub (release lags `package.json`)
- Stronger Linux `pi install` smoke in CI (currently warn-only)
- TillDone extension refactor (large file; opt-in)
- Typed WorkflowKit follow-ups
- Optional coms multi-agent demo / screenshot refresh

## Non-goals

- Second install path (`install.sh`, global npm package duplicate)
- Foundry runtime features (see [Foundry](https://github.com/kartikkabadi/foundry))
- Architecture rewrite without maintainer request

## Maintainer vs contributor

- **Contributors:** [CONTRIBUTING.md](../CONTRIBUTING.md) + [docs/architecture.md](architecture.md)
- **Maintainer-only context:** [AGENTS.maintainer.md](../AGENTS.maintainer.md) (private skills, vault recall — optional)
