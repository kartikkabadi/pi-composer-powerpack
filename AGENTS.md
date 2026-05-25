# Pi Composer Powerpack — AGENTS.md

Guide + curated assets for Pi + Cursor Composer 2.5 + multi-agent workflows.

## Agent bootstrap

Before picking work, read [docs/agents/README.md](docs/agents/README.md). Issue queue: [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md). Domain: [docs/agents/domain.md](docs/agents/domain.md).

**Install:** Pi GitHub installer only — see [README Quick start](README.md#install). Do not add `install.sh`, shell launchers, or a separate npm package setup path unless the maintainer explicitly requests it.

## Working agreements

- Keep README and assets (`extensions/`, `agents/`, `themes/`, `config/`) high-signal for humans and agents.
- No secrets, Pi session JSONL, auth files, or private machine paths in the repo (`npm run check:secrets`).
- Keep `package.json` `pi` field accurate for GitHub installs.
- Smallest change that gives real feedback. Guide purity: edits must serve the GitHub-installed flow.
- Extensions should stay under 1000 LOC per file where practical.

## Review guidelines

- P0: secrets, private data, or large binaries in repo
- After README/manifest/extension changes: run the [CONTRIBUTING.md](CONTRIBUTING.md) PR checklist (`check:secrets`, `pack:dry`, `lint`, `typecheck`, `test`)
- Before release: isolated `pi install` smoke on the GitHub URL

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Maintainer-only context: [AGENTS.maintainer.md](AGENTS.maintainer.md).
