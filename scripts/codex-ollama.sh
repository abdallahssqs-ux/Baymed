#!/usr/bin/env bash
set -euo pipefail

cd /workspace/Baymed

choice="${1:-coder}"
case "$choice" in
  coder) model='qwen2.5-coder:3b' ;;
  arabic) model='qwen3:4b' ;;
  *)
    echo 'Choose coder or arabic: bash scripts/codex-ollama.sh coder|arabic' >&2
    exit 2
    ;;
esac
if [[ $# -gt 0 ]]; then shift; fi

bash scripts/start-ollama.sh
if ! curl --fail --silent http://127.0.0.1:11434/api/tags | \
  node -e 'let s=""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => { const model = process.argv[1]; if (!JSON.parse(s).models.some(item => item.name === model)) process.exit(1); });' "$model"; then
  echo "The $model model is not installed. Run bash scripts/setup-ollama.sh first." >&2
  exit 1
fi

# The cloud agent's CODEX_HOME is managed and read-only. Keep local sessions in
# the workspace without changing hosted Codex authentication or model choice.
export CODEX_HOME=/workspace/.cache/codex-ollama
mkdir -p "$CODEX_HOME"
exec codex --oss --local-provider ollama --model "$model" -C /workspace/Baymed "$@"
