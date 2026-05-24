# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.1.5] - 2026-05-25

### Fixed

- `check:secrets` fails closed when ripgrep is missing

### Changed

- CI installs ripgrep before secret scan

## [0.1.4] - 2026-05-25

### Added

- `pnpm run typecheck` and CI typecheck gate

### Changed

- Fixed TypeScript errors across core extensions
- Excluded `extensions/cursor-sdk.ts` from tsconfig and ESLint

## [0.1.3] - 2026-05-25

### Added

- Explicit peer dependency contract for Pi runtime packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`)

### Changed

- Aligned TypeBox imports to `typebox@1.1.38`

## [0.1.2] - 2026-05-24

### Added

- README terminal preview screenshots (`subagent-running`, `team-grid`, `chain-pipeline`)
- `docs/screenshots/social-preview.png` (1280×640; upload via GitHub repo settings)

### Changed

- README: **Install** subheading under Quick start; corrected bundled agent counts
- Docs aligned to “Quick start (install)” vocabulary (`PLAYBOOK`, `architecture`, `AGENTS`, `troubleshooting`)

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

[0.1.2]: https://github.com/kartikkabadi/pi-composer-powerpack/releases/tag/v0.1.2
[0.1.1]: https://github.com/kartikkabadi/pi-composer-powerpack/releases/tag/v0.1.1
[0.1.0]: https://github.com/kartikkabadi/pi-composer-powerpack/releases/tag/v0.1.0
