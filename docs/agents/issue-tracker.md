# Issue tracker: GitHub

Issues for **kartikkabadi/pi-composer-powerpack**. Use `gh` inside the clone (repo inferred from remote).

## Conventions

- **List open:** `gh issue list --state open`
- **View:** `gh issue view <number> --comments`
- **Create:** `gh issue create --title "..." --body "..."`

## Live queue

No program epic. Default work types:

| Type | Guidance |
|------|----------|
| Docs / release polish | See [ROADMAP.md](../ROADMAP.md) **Next** |
| New features | Only when Kartik requests — avoid architecture refactors by default |
| CI hardening | Optional issue: Linux `pi install` smoke in CI (currently warn-only) |

Releases: tag via [CONTRIBUTING.md](../../CONTRIBUTING.md) / `scripts/release-one.sh` (maintainer).
