const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const COOKIE_FILE = process.env.YTDLP_COOKIE_FILE || "/etc/secrets/cookies.txt";
const WRITABLE_COOKIE_FILE = "/tmp/radio-shak-youtube-cookies.txt";
const POT_PROVIDER_URL = process.env.YTDLP_POT_PROVIDER_URL || "http://127.0.0.1:4416";
const USER_AGENT = process.env.YTDLP_USER_AGENT || "";
const VERSION = "1.3";

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  exposedHeaders: ["Content-Disposition", "Content-Type"]
}));
app.use(express.json({ limit: "1mb" }));

function cookieStatus() {
  try {
    if (!fs.existsSync(COOKIE_FILE)) return { configured: false, readable: false };
    fs.accessSync(COOKIE_FILE, fs.constants.R_OK);
    const stat = fs.statSync(COOKIE_FILE);
    return { configured: true, readable: true, bytes: stat.size };
  } catch (e) {
    return { configured: true, readable: false, error: e.message };
  }
}

function prepareCookies() {
  const status = cookieStatus();
  if (!status.readable) return null;
  try {
    fs.copyFileSync(COOKIE_FILE, WRITABLE_COOKIE_FILE);
    fs.chmodSync(WRITABLE_COOKIE_FILE, 0o600);
    return WRITABLE_COOKIE_FILE;
  } catch (e) {
    console.warn("Cookie copy failed; using mounted file directly:", e.message);
    return COOKIE_FILE;
  }
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Radio Shak MP3 API",
    version: VERSION,
    cookies: cookieStatus(),
    poTokenProvider: POT_PROVIDER_URL
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    cookies: cookieStatus(),
    poTokenProvider: POT_PROVIDER_URL
  });
});

function isAllowedYouTubeUrl(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host);
  } catch {
    return false;
  }
}

function cleanFilename(name) {
  return (name || "radio-shak")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "radio-shak";
}

app.post("/api/mp3", async (req, res) => {
  const url = String(req.body?.url || "").trim();

  if (!url || !isAllowedYouTubeUrl(url)) {
    return res.status(400).json({ ok: false, error: "Lien YouTube invalide." });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "radio-shak-"));
  const outputTemplate = path.join(tempDir, "%(title).120B [%(id)s].%(ext)s");
  const activeCookieFile = prepareCookies();

  const args = [
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--js-runtimes", "node",
    "--remote-components", "ejs:github",

    // Configuration recommandée par yt-dlp pour les protections YouTube récentes.
    "--extractor-args", "youtube:player_client=mweb",
    "--extractor-args", `youtubepot-bgutilhttp:base_url=${POT_PROVIDER_URL}`,

    "-f", "bestaudio/best",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "--embed-metadata",
    "--restrict-filenames",
    "-o", outputTemplate,
  ];

  if (activeCookieFile) args.push("--cookies", activeCookieFile);
  if (USER_AGENT) args.push("--user-agent", USER_AGENT);
  args.push(url);

  let stderr = "";
  let stdout = "";
  let answered = false;

  const cleanup = () => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  };

  const proc = spawn("yt-dlp", args, {
    cwd: tempDir,
    env: { ...process.env, HOME: "/tmp" }
  });

  proc.stdout.on("data", d => {
    stdout += d.toString();
    if (stdout.length > 30000) stdout = stdout.slice(-30000);
  });

  proc.stderr.on("data", d => {
    stderr += d.toString();
    if (stderr.length > 30000) stderr = stderr.slice(-30000);
  });

  proc.on("error", err => {
    if (answered) return;
    answered = true;
    cleanup();
    res.status(500).json({
      ok: false,
      error: "Impossible de démarrer yt-dlp.",
      detail: err.message
    });
  });

  proc.on("close", code => {
    if (answered) return;

    if (code !== 0) {
      answered = true;
      const detail = (stderr || stdout || `yt-dlp exit code ${code}`).trim();
      cleanup();

      let error = activeCookieFile
        ? "YouTube a refusé la conversion malgré l’authentification renforcée."
        : "YouTube demande une authentification. Ajoute cookies.txt comme Secret File dans Render.";

      if (/Sign in to confirm you.?re not a bot/i.test(detail)) {
        error = activeCookieFile
          ? "YouTube bloque encore l’adresse IP ou la session cookies de Render. Réexporte des cookies YouTube frais si nécessaire."
          : "YouTube demande de confirmer que la requête n’est pas un robot. Les cookies YouTube sont absents.";
      }

      return res.status(502).json({
        ok: false,
        error,
        detail,
        cookies: cookieStatus(),
        poTokenProvider: POT_PROVIDER_URL
      });
    }

    const files = fs.readdirSync(tempDir).filter(f => f.toLowerCase().endsWith(".mp3"));
    if (!files.length) {
      answered = true;
      cleanup();
      return res.status(500).json({
        ok: false,
        error: "Le MP3 n'a pas été créé.",
        detail: (stderr || stdout).trim()
      });
    }

    answered = true;
    const mp3Path = path.join(tempDir, files[0]);
    const downloadName = cleanFilename(files[0].replace(/\.mp3$/i, "")) + ".mp3";

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

    const stream = fs.createReadStream(mp3Path);
    stream.pipe(res);
    stream.on("error", () => {
      try { res.destroy(); } catch {}
      cleanup();
    });
    res.on("finish", cleanup);
    res.on("close", cleanup);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Radio Shak MP3 API v${VERSION} on ${PORT}`);
  console.log(`Cookie file: ${COOKIE_FILE}`);
  console.log("Cookie status:", cookieStatus());
  console.log(`PO Token provider: ${POT_PROVIDER_URL}`);
});
