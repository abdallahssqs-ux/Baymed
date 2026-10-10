#!/usr/bin/env bash
set -euo pipefail

image='ollama/ollama@sha256:b86366bb528bbf7f1424435d165028497a5b69bf6ddb4fa5a87102e2b79f44fb'
model_dir='/workspace/.cache/ollama'
container='baymed-ollama'
cert_options=()
network_options=(--network bridge --publish 127.0.0.1:11434:11434)

# The environment proxy is exposed by hostname on the cloud machine, while
# Docker's embedded DNS cannot resolve that hostname inside a bridge network.
# Keep the container isolated and add only the proxy endpoint it needs.
proxy_address="$(getent hosts proxy | awk 'NR==1 {print $1}')"
if [[ -z "$proxy_address" ]]; then
  echo 'The environment proxy hostname cannot be resolved.' >&2
  exit 1
fi
network_options+=(--add-host "proxy:$proxy_address")

if [[ -n "${SSL_CERT_FILE:-}" && -f "$SSL_CERT_FILE" ]]; then
  cert_options=(
    --volume "$SSL_CERT_FILE:/usr/local/share/codex-ca-bundle.pem:ro"
    --env SSL_CERT_FILE=/usr/local/share/codex-ca-bundle.pem
  )
fi

mkdir -p "$model_dir"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker pull "$image"
fi

if docker container inspect "$container" >/dev/null 2>&1; then
  role="$(docker container inspect "$container" --format '{{index .Config.Labels "com.baymed.role"}}')"
  if [[ "$role" != 'ollama' ]]; then
    echo 'The baymed-ollama container name belongs to another service.' >&2
    exit 1
  fi
  if [[ "$(docker inspect "$container" --format '{{.HostConfig.NetworkMode}}')" != 'bridge' ]]; then
    echo 'The baymed-ollama container uses an outdated network mode. Recreate it after preserving the model directory.' >&2
    exit 1
  fi
  if [[ "$(docker inspect "$container" --format '{{.State.Running}}')" != 'true' ]]; then
    docker start "$container" >/dev/null
  fi
else
  docker run -d \
    --name "$container" \
    --label com.baymed.role=ollama \
    --user "$(id -u):$(id -g)" \
    --env OLLAMA_MODELS=/models \
    --env OLLAMA_HOST=0.0.0.0:11434 \
    --env OLLAMA_CONTEXT_LENGTH=32768 \
    --env HTTPS_PROXY --env HTTP_PROXY --env NO_PROXY \
    "${cert_options[@]}" \
    "${network_options[@]}" \
    --volume "$model_dir:/models" \
    "$image" serve >/dev/null
fi

for attempt in {1..30}; do
  if curl --fail --silent --output /dev/null http://127.0.0.1:11434/api/version; then
    echo 'Ollama is ready on the local machine.'
    exit 0
  fi
  sleep 1
done

docker logs --tail 20 "$container" >&2
echo 'Ollama did not become ready.' >&2
exit 1
