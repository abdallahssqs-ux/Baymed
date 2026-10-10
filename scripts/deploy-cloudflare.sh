#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# OpenNext treats .dev.vars as deploy secrets. Keep local-only settings out of
# the production Worker, even when a developer has a local preview running.
temporary_dir="$(mktemp -d /tmp/baymed-deploy.XXXXXX)"
restore_dev_vars() {
  if [[ -f "$temporary_dir/.dev.vars" ]]; then
    mv "$temporary_dir/.dev.vars" .dev.vars
  fi
  rmdir "$temporary_dir"
}
trap restore_dev_vars EXIT
if [[ -f .dev.vars ]]; then
  mv .dev.vars "$temporary_dir/.dev.vars"
fi

./node_modules/.bin/opennextjs-cloudflare deploy "$@"
