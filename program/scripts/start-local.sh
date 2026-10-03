#!/usr/bin/env bash
# Local full stack inside the devcontainer: offline Surfpool + single-port proxy on :8899
# (the container publishes only 8899; web3.js needs both HTTP and WebSocket),
# then deploys the program and seeds a demo fund.
#
#   docker exec -it -w /app/careswitch/program <container> bash scripts/start-local.sh
# Then on the host: cd careswitch/app && VITE_RPC=http://localhost:8899 npm run dev
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=/root/.nvm/versions/node/v22.22.3/bin:$PATH
L=http://127.0.0.1:18899

pkill -f "surfpool start" || true
pkill -f "rpc-proxy.mjs" || true
(cd /tmp && nohup surfpool start --no-tui --offline --host 127.0.0.1 --port 18899 --ws-port 18900 > /tmp/surf.log 2>&1 &)
nohup node scripts/rpc-proxy.mjs > /tmp/proxy.log 2>&1 &

until solana cluster-version --url $L >/dev/null 2>&1; do sleep 1; done
solana airdrop 50 --url $L >/dev/null
solana program deploy target/deploy/careswitch.so \
  --program-id target/deploy/careswitch-keypair.json --url $L
RPC=$L TIMEOUT=${TIMEOUT:-30} node --experimental-strip-types --no-warnings scripts/seed-demo.ts
