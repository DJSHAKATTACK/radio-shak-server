FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/yt-dlp-venv \
    && /opt/yt-dlp-venv/bin/pip install --no-cache-dir -U "yt-dlp[default]"

ENV PATH="/opt/yt-dlp-venv/bin:${PATH}"
ENV NODE_ENV=production
ENV YTDLP_COOKIE_FILE=/etc/secrets/cookies.txt

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 10000

CMD ["node", "server.js"]