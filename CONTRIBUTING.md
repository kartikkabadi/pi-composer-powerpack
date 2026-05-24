# Contributing

Thanks for helping improve Pi Composer Powerpack.

## Before you start

- Read [AGENTS.md](AGENTS.md) for maintainer rules (GitHub-installer-only flow, no secrets in repo).
- Requires **Pi ≥ 0.75.3** and familiarity with Pi extensions.

## Development setup

```bash
git clone https://github.com/kartikkabadi/pi-composer-powerpack.git
cd pi-composer-powerpack
sfw pnpm install
```

Use `sfw` (Socket Firewall) for any `pnpm` / `npm` operations on maintainer machines.

## Making changes

1. Fork and create a branch from `main`.
2. Keep changes focused; match existing TypeScript and agent markdown style.
3. Update [README.md](README.md) when install behavior, commands, or `package.json` `pi` / `files` change.
4. Run checks before opening a PR:

```bash
sfw pnpm run check:secrets
sfw pnpm run pack:dry
```

5. Open a PR with a clear summary and test notes.

## Pull request checklist

- [ ] README and docs updated if user-facing behavior changed
- [ ] `package.json` `pi.extensions` and `files` remain accurate
- [ ] `check:secrets` and `pack:dry` pass
- [ ] No secrets, session JSONL, auth files, or machine-specific paths committed

## Release

Releases are cut by the maintainer using `scripts/release-one.sh`:

```bash
# Pre-flight (must all pass)
sfw pnpm run check:secrets
sfw pnpm run pack:dry
sfw pnpm run lint
sfw pnpm run typecheck
sfw pnpm test

# Cut a release (pushes tag + GH release — review before running)
./scripts/release-one.sh 0.2.15 "short subject" [extra-paths...]
```

The script bumps `package.json` version, prepends a CHANGELOG entry, commits, tags, pushes, and creates a GitHub release. Never re-run batch release scripts (`release-phase-b-batch.sh`) — they are historical reference only.

## Reporting issues

Use GitHub Issues with the bug or feature template. For security issues, see [SECURITY.md](SECURITY.md).
