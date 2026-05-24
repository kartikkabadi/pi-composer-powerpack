# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.2.15] - 2026-05-25

### Added

- `extensions/lib/workflowKit.ts` — shared `renderStatusCard`, `installContextFooter`, `renderToolCallLine`, truncation helpers, `clearSessionFiles` (Phase 1)
- `extensions/lib/childAgentSession.ts` — single spawn seam unifying subprocess config and specialist spawn (Phase 3)
- `extensions/coms/session.ts` — extracted coms session lifecycle (boot, keepalive, response capture, shutdown) from monolithic index (Phase 4)
- `docs/CONTEXT.md` — domain glossary and config cascade reference (Phase 0)
- `docs/adr/0001-agent-precedence.md` — agent definition precedence decision record (Phase 0)
- Table-driven damage-control-rules tests (58 test cases covering bash blocks, ask patterns, allow list, zero-access, read-only, no-delete paths) (Phase 4)
- Precedence and merge tests for `scanAgents`, `mergeChains`, `mergeTeams` (Phase 2)
- `scripts/release-one.sh`, `scripts/phase-b-release.sh` committed with safety headers (Phase 0)

### Changed

- `agentDefinitions.ts` imports `piAgentHome` from `powerpackPaths.ts` (was `subagentConfig.ts`) — fixes import indirection (Phase 2)
- `scanAgents` precedence documented and reordered: project → global → package (first-seen wins) (Phase 2)
- `agent-chain.ts`, `agent-team.ts`, `pi-pi.ts` migrated to shared WorkflowKit rendering (Phase 1)
- All spawn callers migrated from `runSpecialistSpawn` to `spawnChildAgent` from `childAgentSession.ts` (Phase 3)
- `auto-caveman.ts` uses shared `parseMarkdownFrontmatter` + `applyExtensionDefaults` (Phase 4)
- Pi-Pi expert prompts slimmed — removed mandatory `firecrawl`/`curl` blocks, kept expert identity and domain knowledge (Phase 5)
- `themeMap.ts` documented phantom themes (only `mono-black` ships in package) (Phase 5)
- `bowser.md` notes external `playwright-bowser` skill dependency (Phase 5)
- `SECURITY.md` updated supported versions to 0.2.x (Phase 0)
- `docs/extensions.md` semver wording generalised to 0.x (Phase 0)
- CHANGELOG 0.2.12 duplicate entry removed (Phase 0)
- `docs/architecture.md` config cascade precedence table added (Phase 2)
- `CONTRIBUTING.md` release section and full checklist added (Phase 0/6)
- `README.md` verify section includes full CI command list (Phase 6)

## [0.2.14] - 2026-05-24

### Changed

- damageControlRules.evaluateToolCall extraction
## [0.2.13] - 2026-05-24

### Changed

- CI socketdev action and sfw install
## [0.2.12] - 2026-05-24

### Changed

- agent-chain pipeline widget stays local (pipeline arrows remain in agent-chain.ts)
## [0.2.11] - 2026-05-25

### Changed

- agent-team dashboard uses shared workflowGrid helpers

## [0.2.10] - 2026-05-25

### Changed

- pi-pi dashboard uses shared workflowGrid helpers

## [0.2.9] - 2026-05-25

### Changed

- ComsRuntime module; thin coms index adapter

## [0.2.8] - 2026-05-24

### Changed

- coms transport readOneLineCapped and unified ping helper

## [0.2.7] - 2026-05-24

### Changed

- agent-chain runAgent via runSpecialistSpawn

## [0.2.6] - 2026-05-24

### Changed

- agent-team dispatch via runSpecialistSpawn

## [0.2.5] - 2026-05-24

### Changed

- pi-pi queryExpert via runSpecialistSpawn

## [0.2.4] - 2026-05-24

### Changed

- specialistSpawn lib and subagent-widget migration
## [0.2.3] - 2026-05-25

### Added

- Shared `frontmatter.ts` parser; `loadPiPiExperts(cwd)` with documented precedence

### Changed

- coms and agentDefinitions use shared frontmatter seam
- pi-pi expert discovery via `loadPiPiExperts`
- Fix v0.2.2 broken spawn imports (revert to `spawnPiJsonProcess` until v0.2.4)

## [0.2.2] - 2026-05-25

### Changed

- Canonical `piAgentHome()` in powerpackPaths; removed duplicate `getPiAgentHome`

## [0.2.1] - 2026-05-24

### Changed

- complete DC redaction
## [0.2.0] - 2026-05-25

### Added

- Split coms into `extensions/coms/*` modules
- Damage-control log redaction; child subprocess DC enabled by default
- linux-smoke CI matrix; coms transport + redaction tests

## [0.1.9] - 2026-05-25

### Added

- `agentDefinitions` shared library; replaced hand-rolled YAML parsers
- Stub-pi harness and subprocess/scan tests

### Changed

- Migrated agent-chain and agent-team spawns to `spawnPiJsonProcess`

## [0.1.8] - 2026-05-25

### Added

- Shared subprocess modules (`subagentConfig`, `piJsonSubprocess`)

### Changed

- Migrated subagent-widget and pi-pi expert spawns to shared NDJSON runner
- Child damage-control is opt-in (`PI_SUBAGENT_DAMAGE_CONTROL=1`) until v0.2.0

## [0.1.7] - 2026-05-25

### Added

- Troubleshooting: migration, glibc/Linux matrix, install failures, damage-control precedence
- README doc links use GitHub URLs for tarball installs
- Ignore `.pi/` in git

## [0.1.6] - 2026-05-25

### Fixed

- Pi-pi team dispatch scans `agents/pi-pi/` subdirectory

### Added

- `cli-expert` and `keybinding-expert` in `agents/teams.yaml`
- Agent/team drift test (`test/matrix.test.mjs`)

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
