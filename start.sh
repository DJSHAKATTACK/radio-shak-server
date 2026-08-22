#!/bin/sh
set -u

# Le fournisseur PO Token reste local au conteneur Render.
node /opt/bgutil-ytdlp-pot-provider/server/build/main.js >/tmp/bgutil-provider.log 2>&1 &
POT_PID=$!

echo "PO Token provider démarré (PID $POT_PID)."

# Quelques secondes ne sont normalement pas nécessaires : yt-dlp appellera le provider au besoin.
exec node /app/server.js
