#!/bin/sh
set -eu

if [ "${DEPLOY_COMMANDS_ON_START:-true}" = "true" ]; then
  if [ -z "${BOT_TOKEN:-}" ] || [ -z "${CLIENT_ID:-}" ]; then
    echo "[entrypoint] BOT_TOKEN and CLIENT_ID are required to deploy commands on startup."
    exit 1
  fi

  echo "[entrypoint] Deploying slash commands..."
  node dist/deploy-commands.js
fi

echo "[entrypoint] Starting bot..."
exec "$@"
