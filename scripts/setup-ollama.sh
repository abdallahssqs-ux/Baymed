#!/usr/bin/env bash
set -euo pipefail

cd /workspace/Baymed
bash scripts/start-ollama.sh

needs_download=false
for model in qwen2.5-coder:3b qwen3:4b; do
  if ! docker exec -e OLLAMA_HOST=127.0.0.1:11434 baymed-ollama ollama show "$model" >/dev/null 2>&1; then
    needs_download=true
  fi
done

if [[ "$needs_download" == true ]]; then
  bash scripts/prepare-ollama-dns.sh
fi

for model in qwen2.5-coder:3b qwen3:4b; do
  if ! docker exec -e OLLAMA_HOST=127.0.0.1:11434 baymed-ollama ollama show "$model" >/dev/null 2>&1; then
    docker exec -e OLLAMA_HOST=127.0.0.1:11434 baymed-ollama ollama pull "$model"
  fi
done

docker exec -e OLLAMA_HOST=127.0.0.1:11434 baymed-ollama ollama list
