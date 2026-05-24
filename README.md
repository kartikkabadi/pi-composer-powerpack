# Pi Composer Powerpack

Cursor Composer 2.5 and multi-agent workflow extensions for Pi.

This package bundles the pieces I use to make Pi behave like a fast Composer-backed coding runtime:

- `pi-cursor-sdk` loaded as the Cursor provider
- Composer 2.5 fast-mode launchers
- `damage-control-continue`
- live subagent widgets
- same-machine Pi-to-Pi `coms`
- chain/team/Pi-Pi specialist workflows
- curated agents, chains, teams, and the `mono-black` theme

## Install

Prerequisites:

- Pi `>=0.75.3`
- `pi-cursor-sdk >=0.1.16` installed in your Pi profile

```bash
pi install npm:pi-cursor-sdk@0.1.16
pi install https://github.com/kartikkabadi/pi-composer-powerpack
git clone https://github.com/kartikkabadi/pi-composer-powerpack ~/Projects/pi-composer-powerpack
~/Projects/pi-composer-powerpack/install.sh
```

The Cursor SDK is installed separately so machines with pnpm release-age guards can choose when to accept a fresh Cursor SDK version. The powerpack activates the wrapper/config package. `install.sh` copies launchers, agents, chains, teams, the theme, and damage-control rules.

## Launchers

```bash
pi-elite    # plain Composer 2.5 fast mode
pi-team     # dispatch_agent orchestrator
pi-chain    # run_chain pipeline dispatcher
pi-pi-lab   # Pi extension/config expert lab
```

`pi-chain` intentionally uses `--no-extensions` to avoid the normal default stack fighting the pipeline prompt. It explicitly loads this package's `cursor-sdk.ts` first, then `agent-chain.ts`, then `damage-control-continue.ts`. That keeps chain mode isolated without losing the `cursor` provider or `--cursor-fast` flag.

## Local Smoke Test

From this checkout:

```bash
PI_POWERPACK_HOME="$PWD" ./bin/pi-chain --no-session --no-tools -p "Reply exactly OK"
```

Expected output:

```text
OK
```

## Safety

This repo intentionally excludes:

- Pi session JSONL files
- auth files and API keys
- memory databases
- socket files
- private machine-wide agent configs

Run this before publishing:

```bash
npm run check:secrets
```
