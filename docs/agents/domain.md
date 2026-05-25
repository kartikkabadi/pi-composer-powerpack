# Domain Docs

## Before exploring, read these

- [docs/architecture.md](../architecture.md) — Pi package model, extensions, config cascade
- [docs/adr/0001-agent-precedence.md](../adr/0001-agent-precedence.md) — agent definition precedence
- [extensions/README.md](../../extensions/README.md) — extension index
- [docs/troubleshooting.md](../troubleshooting.md) — install and auth failures

## Not this repo

**Foundry** ([kartikkabadi/foundry](https://github.com/kartikkabadi/foundry)) is the planning/build CLI runtime — separate product. This repo is the Pi **guide + extensions** layer only.

## Vocabulary

Use terms from [docs/CONTEXT.md](../CONTEXT.md). Agent precedence: project → global → package (first-seen wins) per ADR-0001.
