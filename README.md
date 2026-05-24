# Pi Composer Powerpack

Cursor Composer 2.5 and multi-agent workflow extensions for Pi.

This package is meant to be installed with Pi's GitHub installer. It does not use `install.sh`, shell launchers, or a second manual npm install step.

## Install

```bash
pi install https://github.com/kartikkabadi/pi-composer-powerpack
```

The package declares `pi-cursor-sdk@0.1.16` as a normal dependency, so Pi installs the Cursor provider with the powerpack.

## Start Pi

```bash
pi --model cursor/composer-2.5 --cursor-fast
```

The GitHub install activates these extensions from `package.json`:

- `cursor-sdk` for the `cursor/*` provider
- `damage-control-continue` with bundled fallback rules from `config/`
- `subagent-widget` for `/sub`, `/subcont`, `/subrm`, and `/subclear`
- `coms` for same-machine Pi-to-Pi messaging
- `agent-chain`, `agent-team`, and `pi-pi` as dormant workflow modes

## Workflow Commands

The workflow extensions are available after install, but they do not take over the session until you opt in:

```text
/chain-mode          Activate run_chain dispatcher mode
/chain-run <task>    Run the active chain on a task
/chain               Switch chain
/chain-list          List bundled/project chains
/direct              Leave chain dispatcher mode

/agents-mode         Activate team dispatcher mode
/agents-team         Switch team and enter team mode
/agents-off          Leave team dispatcher mode
/agents-list         List team agents

/pi-pi-mode          Activate Pi extension/config expert mode
/pi-pi-off           Leave Pi Pi mode
/experts             List Pi Pi experts

/sub <task>          Spawn a background subagent
/coms                Refresh/filter the peer-agent pool
```

Bundled agents, teams, chains, and Pi Pi experts live in `agents/`. Project-local files in `.pi/agents/` can override or extend them.

## Verify

From this checkout:

```bash
sfw pnpm run check:secrets
sfw pnpm run pack:dry
```

After installing into a Pi profile, a basic smoke test is:

```bash
pi --model cursor/composer-2.5 --cursor-fast --no-session --no-tools -p "Reply exactly OK"
```

Expected response:

```text
OK
```

## Safety

This repo intentionally excludes Pi session files, auth files, API keys, memory databases, socket files, and private machine-wide configs.
