# Changelog

All notable changes to this project are documented in this file.

## [0.1.1] - 2026-05-24

### Added

- README onboarding: auth, extension table, env vars, bundled assets, docs index
- `CONTRIBUTING.md`, `SECURITY.md`, `docs/architecture.md`, `docs/troubleshooting.md`, `docs/extensions.md`
- GitHub community health: CI, Dependabot, issue/PR templates, `CODEOWNERS`
- ESLint, TypeScript config, `.editorconfig`, `extensions/README.md`
- Screenshot playbook at `docs/screenshots/PLAYBOOK.md`

### Changed

- GitHub repo description and topics
- `themeMap` entries limited to in-repo extensions
- Node built-in imports (`node:fs`, `node:path`, `node:child_process`) in core extensions
- `superset-hooks` import scope aligned with `@earendil-works/pi-coding-agent`

## [0.1.0] - 2026-05-24

### Added

- Initial Pi Composer Powerpack: Cursor Composer 2.5 via bundled `pi-cursor-sdk@0.1.16`
- Extensions: `cursor-sdk`, `damage-control-continue`, `subagent-widget`, `coms`, `agent-chain`, `agent-team`, `pi-pi`
- Bundled agents, chains (`agents/agent-chain.yaml`), teams (`agents/teams.yaml`), Pi-Pi experts
- `mono-black` theme and damage-control rules in `config/`
- Dormant workflow modes: `/chain-mode`, `/agents-mode`, `/pi-pi-mode` with matching off commands
- GitHub-installer-only flow (no `install.sh` or shell launchers)

### Changed

- PR #1: consolidated install path — single `pi install` from GitHub URL

[0.1.0]: https://github.com/kartikkabadi/pi-composer-powerpack/releases/tag/v0.1.0
