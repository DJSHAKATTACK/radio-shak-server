FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    ca-certificates \
    curl \
    git \
    build-essential \
    libcairo2-dev \
    libjpeg62-turbo-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/yt-dlp-venv \
    && /opt/yt-dlp-venv/bin/pip install --no-cache-dir -U "yt-dlp[default]" bgutil-ytdlp-pot-provider

# Fournisseur de PO Token local. Le plugin yt-dlp communique avec lui sur le port 4416.
RUN git clone --depth 1 --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider \
    && cd /opt/bgutil-ytdlp-pot-provider/server \
    && npm ci \
    && npx tsc \
    && npm cache clean --force

ENV PATH="/opt/yt-dlp-venv/bin:${PATH}"
ENV NODE_ENV=production
ENV YTDLP_COOKIE_FILE=/etc/secrets/cookies.txt
ENV YTDLP_POT_PROVIDER_URL=http://127.0.0.1:4416

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY start.sh ./
RUN chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]
