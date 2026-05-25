# Pi Composer Powerpack — AGENTS.md

Guide + curated assets for Pi + Cursor Composer 2.5 + multi-agent workflows.

**Install:** Pi GitHub installer only — see [README Quick start](README.md#install). Do not add `install.sh`, shell launchers, or a separate npm setup path unless the maintainer explicitly requests it.

## Read order

1. [README.md](README.md) — user install and commands
2. [docs/architecture.md](docs/architecture.md) — extension tiers and config cascade
3. [docs/CONTEXT.md](docs/CONTEXT.md) — glossary
4. [docs/ROADMAP.md](docs/ROADMAP.md) — shipped vs next

Maintainer-only machine context: [AGENTS.maintainer.md](AGENTS.maintainer.md) (optional).

## Working agreements

- Keep README and assets (`extensions/`, `agents/`, `themes/`, `config/`) high-signal for humans and agents.
- No secrets, Pi session JSONL, auth files, or private machine paths in the repo (`npm run check:secrets`).
- Keep `package.json` `pi` field accurate for GitHub installs.
- Smallest change that gives real feedback. Guide purity: edits must serve the GitHub-installed flow.
- Extensions should stay under 1000 LOC per file where practical.

## Review guidelines

- P0: secrets, private data, or large binaries in repo
- After README/manifest/extension changes: `check:secrets`, `pack:dry`, `lint`, `typecheck`, `test`
- Before release: isolated `pi install` smoke on the GitHub URL

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Use standard git fork/PR flow; `sfw` recommended if Socket Firewall is available.
