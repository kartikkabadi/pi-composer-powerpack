# Pi Composer Powerpack

Cursor Composer 2.5 and multi-agent workflow extensions for Pi.

This package bundles the pieces I use to make Pi behave like a fast Composer-backed coding runtime:

- `pi-cursor-sdk` loaded as the Cursor provider
- Composer 2.5 fast-mode launchers
- `damage-control-continue`
- live subagent widgets
- same-machine Pi-to-Pi `coms`
- chain/team/Pi-Pi specialist workflows
- curated agents, chains, teams, and the `mono-black` theme (all activated via the GitHub `pi install` path)

## This Repo Is a Guide + Curated Assets (Feed It to Your Agent)

**Not a script you run.** This is a guide and a whole Git repo of things you can do with a polished Pi + Cursor Composer 2.5 + multi-agent setup (launchers, extensions for coms/damage-control/agents/chains/teams, prompts, mono-black theme, install.sh, config, etc.).

**Feed the whole repo (or this README + key dirs like agents/, extensions/, bin/) to your agent and say:**

"Hey, look at this Pi Extension Pack repo. Use it to set up a polished Pi + Composer 2.5 experience for me. Ask me these questions first (the 10 coverage slots from the Foundry spec):

1. User / beneficiary  
2. Current pain or job-to-be-done  
3. Desired outcome  
4. Minimum useful version  
5. Non-goals / what to delete  
6. Reference products / desired feel  
7. Constraints  
8. Quality bar / done proof  
9. Risk / unacceptable failure  
10. Autonomy / execution preference  

Then walk me through the copy-paste setup using the GitHub installer (pi install https://github.com/kartikkabadi/pi-composer-powerpack after the cursor-sdk one). Once activated via the package "pi" field, use the launchers (pi-elite etc. in PATH), the extensions (coms, damage-control-continue, subagent-widget, cursor-sdk), agents/ prompts, and mono-black theme from the pack. Help me choose what I want and set everything up safely (Pi >=0.75.3, pi-cursor-sdk, etc.)."

The agent should walk the user through the intent questions first (product-boundary, not low-level impl), then the guide steps, using the curated assets in this repo as the source of truth for the polished experience.

**Cross-link**: For the rock-solid, detailed, actual multi-agent planning/build runtime (doctor/setup/plan/build with Composer 2.5 exclusive, artifacts, autonomy contracts, etc.) that sits on top of this Pi Extension Pack setup, see the sibling **Foundry** repo: https://github.com/kartikkabadi/foundry (and its V1 planning docs). Both repos are active, cross-linked, and aligned per the 2026-05 clarification (powerpack = the guide layer; Foundry = the higher-level runtime).

## Install (GitHub / Primary Path)

The recommended way for normal users is the GitHub installer (this activates the pack via the "pi" field in package.json — extensions + themes — with no manual script run).

Prerequisites:

- Pi `>=0.75.3`
- `pi-cursor-sdk >=0.1.16` installed in your Pi profile

```bash
pi install npm:pi-cursor-sdk@0.1.16
pi install https://github.com/kartikkabadi/pi-composer-powerpack
```

After install, the launchers (pi-elite, pi-team, pi-chain, pi-pi-lab) and extensions are available per the pack.

**Local dev / testing from this checkout only** (not for normal users):

```bash
git clone https://github.com/kartikkabadi/pi-composer-powerpack ~/Projects/pi-composer-powerpack
# (optional, for dev) ~/Projects/pi-composer-powerpack/install.sh
```

See `install.sh` header for details — it is a dev helper only. The GitHub `pi install` path is the supported one.

The Cursor SDK is installed separately so machines with pnpm release-age guards can choose when to accept a fresh Cursor SDK version. The powerpack activates via its package.json "pi" field (4 extensions + themes).

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
