#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("BayMed requires Node.js 24");'

if [[ ! -f .dev.vars ]]; then
  cp .dev.vars.example .dev.vars
fi

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$PWD/.cache/config}"
export npm_config_cache="${npm_config_cache:-$PWD/.cache/npm}"
mkdir -p "$XDG_CONFIG_HOME" "$npm_config_cache"
npm ci --no-fund
npm run db:migrate:local
