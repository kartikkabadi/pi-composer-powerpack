#!/usr/bin/env bash
set -euo pipefail

PI_HOME="${PI_HOME:-$HOME/.pi/agent}"
POWERPACK_HOME="${PI_POWERPACK_HOME:-$PI_HOME/npm/node_modules/pi-composer-powerpack}"
LOCAL_BIN="${LOCAL_BIN:-$HOME/.local/bin}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$PI_HOME/agents/pi-pi" "$PI_HOME/themes" "$LOCAL_BIN"

cp -R "$REPO_ROOT/agents/." "$PI_HOME/agents/"
cp -R "$REPO_ROOT/themes/." "$PI_HOME/themes/"
# damage-control-rules: use PI_HOME if set (GitHub installer / normal flow activates via package.json "pi" field; this line is for local/dev testing only)
DAMAGE_HOME="${PI_HOME:-$HOME/.pi}"
mkdir -p "$DAMAGE_HOME"
cp "$REPO_ROOT/config/damage-control-rules.yaml" "$DAMAGE_HOME/damage-control-rules.yaml"

for launcher in pi-elite pi-team pi-chain pi-pi-lab; do
  cp "$REPO_ROOT/bin/$launcher" "$LOCAL_BIN/$launcher"
  chmod +x "$LOCAL_BIN/$launcher"
done

cat <<MSG
Installed Pi Composer Powerpack assets.

Next steps:
  1. Install the package into Pi:
     pi install https://github.com/kartikkabadi/pi-composer-powerpack

  2. Run the launchers:
     pi-elite
     pi-team
     pi-chain
     pi-pi-lab

If you are testing from this checkout before publishing, use:
  PI_POWERPACK_HOME="$REPO_ROOT" pi-chain --no-session --no-tools -p "Reply exactly OK"
MSG
