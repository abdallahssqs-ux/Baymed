#!/usr/bin/env bash
set -euo pipefail

# Ollama checks the IP of redirect targets before downloading model layers.
# The cloud proxy allows the HTTPS request but does not expose public DNS to
# local processes, so ask Cloudflare's DNS-over-HTTPS resolver for this host.
r2_host='dd20bb891979d25aebc8bec07b2b3bbc.r2.cloudflarestorage.com'
dns_response="$(curl --fail --show-error --silent --max-time 15 --get \
  --header 'accept: application/dns-json' \
  --data-urlencode "name=$r2_host" \
  --data-urlencode 'type=A' \
  https://cloudflare-dns.com/dns-query)"

r2_address="$(printf '%s' "$dns_response" | node -e '
  const net = require("node:net");
  let data = "";
  process.stdin.on("data", chunk => data += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(data);
    if (response.Status !== 0) throw new Error("DNS lookup did not succeed");
    const address = response.Answer?.find(record => record.type === 1 && net.isIP(record.data) === 4)?.data;
    if (!address) throw new Error("DNS response has no IPv4 address");
    process.stdout.write(address);
  });
')"

docker exec --user 0 baymed-ollama sh -c '
  temp_file=$(mktemp)
  printf "%s %s\n" "$1" "$2" > "$temp_file"
  cat /etc/hosts >> "$temp_file"
  cat "$temp_file" > /etc/hosts
  rm "$temp_file"
' sh "$r2_address" "$r2_host"

docker exec baymed-ollama getent ahostsv4 "$r2_host" >/dev/null
echo 'Ollama model storage host resolves through trusted DNS.'
