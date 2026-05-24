# Troubleshooting

## Install and startup

**Canonical install** (same as [README Quick start](../README.md#install)):

```bash
pi install https://github.com/kartikkabadi/pi-composer-powerpack
pi --model cursor/composer-2.5 --cursor-fast
```

Requires Pi **≥ 0.75.3**. Auth is post-install: run `/login` in Pi before your first real session.

### `pi install` fails or package not found

- Confirm Pi **≥ 0.75.3**.
- Use the full GitHub URL: `pi install https://github.com/kartikkabadi/pi-composer-powerpack`
- On maintainer machines with release-age gates, use `sfw pnpm` when developing locally; end users install via `pi install`, not `pnpm install` in the repo.

### Extensions not loading

- List installed packages in your Pi profile and confirm `pi-composer-powerpack` appears.
- Restart Pi after install.

## Authentication (Cursor)

### Models listed but every run fails

1. Run `/login` in Pi and save a Cursor API key.
2. Start with: `pi --model cursor/composer-2.5 --cursor-fast`
3. See [pi-cursor-sdk](https://github.com/fitchmultz/pi-cursor-sdk) docs for provider-specific errors.

### Subagents fail while main session works

- Subagents use `PI_SUBAGENT_MODEL` (default `cursor/composer-2.5`) and the bundled cursor-sdk path.
- Set `PI_CURSOR_SDK_EXTENSION` if your profile installs extensions elsewhere.

## Workflow modes

### Chain does not run

- Activate dispatcher: `/chain-mode`
- List chains: `/chain-list`
- Set `PI_DEFAULT_CHAIN` if the default name is missing from your YAML.
- Set `PI_CHAIN_ENFORCE=1` only when you want to force `run_chain` on the last user message.

### Team dispatcher inactive

- Run `/agents-mode` after install (team extension is dormant by default).
- Use `/agents-team` to switch teams defined in `agents/teams.yaml` or `.pi/agents/teams.yaml`.

### Pi-Pi experts say inactive

- Run `/pi-pi-mode` before querying experts.

## Coms

- Peers use sockets under `PI_COMS_DIR` (default `~/.pi/coms`).
- Ensure multiple Pi processes run on the same machine and `/coms` has been used to refresh the pool.

## Damage control

- Bundled rules ship in `config/damage-control-rules.yaml`.
- User overrides: `~/.pi/damage-control-rules.yaml` (if present) take precedence per extension logic.

## Maintainer checks

```bash
sfw pnpm run check:secrets
sfw pnpm run pack:dry
```

Smoke (requires Cursor auth):

```bash
pi --model cursor/composer-2.5 --cursor-fast --no-session --no-tools -p "Reply exactly OK"
```
