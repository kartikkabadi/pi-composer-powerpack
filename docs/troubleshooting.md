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
- **Project rules win:** `.pi/damage-control-rules.yaml` in the current project overrides bundled defaults and `~/.pi/damage-control-rules.yaml`.
- User-global overrides: `~/.pi/damage-control-rules.yaml` (used when no project file exists).

## Conflicts and migration

If you previously installed overlapping extensions manually (`subagent-widget`, old `coms`, duplicate `pi-cursor-sdk`, etc.):

1. Run `pi list` and note installed packages/extensions.
2. Remove duplicates: `pi remove <package-or-extension-id>` for anything that duplicates powerpack entries.
3. Drop manual `-e extensions/...` flags from shell aliases if they now load automatically via `pi install`.
4. Restart Pi after cleanup.

Extension IDs are stable per path; reinstalling the powerpack with `pi install https://github.com/kartikkabadi/pi-composer-powerpack` refreshes bundled assets without a separate npm step.

## Linux / Docker / glibc

The bundled `pi-cursor-sdk` pulls native dependencies (notably `sqlite3`) that require **glibc ≥ 2.38** on Linux.

| Environment | Typical result |
|-------------|----------------|
| Node 22 on **trixie** (glibc 2.41+) | Works — recommended CI/dev baseline |
| Node 22 on **bookworm** (glibc 2.36) | May fail loading cursor-sdk (`GLIBC_2.38` not found) |
| macOS / Windows | Use official Pi + Node 22 LTS builds |

Mitigations on older Linux:

- Prefer a trixie-based or newer container image.
- Or install build tooling (`build-essential`, `libsqlite3-dev`) and allow native rebuild (slower, not guaranteed on all distros).

See the optional `linux-smoke` CI job in `.github/workflows/ci.yml` (trixie pass, bookworm may warn).

## Child agent safety

Subagents spawned by `/sub`, `run_chain`, `dispatch_agent`, and `query_experts` run with `--no-extensions` plus cursor-sdk and **damage-control-continue** by default.

- Opt out: `PI_SUBAGENT_DAMAGE_CONTROL=0`
- Subprocesses inherit `process.env` — do not rely on child isolation for secrets in env vars.

## Fresh install failures

- **Node 25+ / bleeding edge:** Some native modules may lack prebuilds; prefer **Node 22 LTS**.
- **Empty npm cache / cert errors:** Retry install; ensure system CA certs are current.
- **Maintainer Socket Firewall:** Use `sfw pnpm install` locally; end users install via `pi install`, not repo `pnpm install`.

## Maintainer checks

```bash
sfw pnpm run check:secrets
sfw pnpm run pack:dry
```

Smoke (requires Cursor auth):

```bash
pi --model cursor/composer-2.5 --cursor-fast --no-session --no-tools -p "Reply exactly OK"
```
