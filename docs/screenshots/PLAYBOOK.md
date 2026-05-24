# Screenshot playbook

Real Pi terminal sessions only — no mock UI. Target: ~1200px wide PNGs under this directory.

## Setup

- Terminal: 120×40 or larger, 14–16px monospace, dark background.
- `pi install https://github.com/kartikkabadi/pi-composer-powerpack`
- `pi --model cursor/composer-2.5 --cursor-fast` (after `/login`)

## Shot A — `subagent-running.png`

```text
/sub List files under extensions/ and reply with exactly three filenames.
# wait for widget activity
/sub Reply with exactly: WIDGET_DEMO_OK
```

Capture: two subagent widgets (running + done).

## Shot B — `team-grid.png`

```text
/agents-mode
/agents-team
# select plan-build or full
Review README.md for typos only. Use scout then reviewer.
```

Capture: agent-team grid with mixed statuses.

## Shot C — `chain-pipeline.png`

```text
/chain-mode
/chain-list
/chain-run Summarize the Quick start (install) section of README in under 40 words.
```

Capture: chain pipeline widget with steps in different states.

## Capture (macOS)

```bash
screencapture -x -l<WINDOW_ID> docs/screenshots/subagent-running.png
sips -Z 1200 docs/screenshots/*.png
```

Upload the best crop to GitHub **Settings → General → Social preview** (1280×640).
