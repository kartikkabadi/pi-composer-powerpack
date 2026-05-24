# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a vulnerability

**Do not** open a public GitHub issue for security-sensitive reports.

Please report vulnerabilities privately:

1. Use [GitHub Security Advisories](https://github.com/kartikkabadi/pi-composer-powerpack/security/advisories/new) for this repository, or
2. Contact the maintainer via GitHub (@kartikkabadi) with details and reproduction steps.

We aim to acknowledge reports within a few business days and will coordinate disclosure and fixes before public detail when appropriate.

## Scope

In scope: this repository’s extensions, bundled config, and install/packaging behavior.

Out of scope: vulnerabilities in Pi itself, `pi-cursor-sdk`, or Cursor’s API — report those to the respective projects.

## Safe use

- Never commit API keys, Pi session files, or `~/.pi` auth material to this repo.
- Review Dependabot and contributor PRs before merge; verify the author is `dependabot[bot]` for automated dependency PRs.
- Run `sfw pnpm run check:secrets` before releases (or `pnpm run check:secrets` if Socket Firewall is not used).
