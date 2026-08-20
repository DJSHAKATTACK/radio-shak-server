const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const COOKIE_FILE = process.env.YTDLP_COOKIE_FILE || "/etc/secrets/cookies.txt";

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  exposedHeaders: ["Content-Disposition", "Content-Type"]
}));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Radio Shak MP3 API",
    version: "1.2",
    cookiesConfigured: fs.existsSync(COOKIE_FILE)
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    version: "1.2",
    cookiesConfigured: fs.existsSync(COOKIE_FILE)
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
    return res.status(400).json({
      ok: false,
      error: "Lien YouTube invalide."
    });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "radio-shak-"));
  const outputTemplate = path.join(tempDir, "%(title).120B [%(id)s].%(ext)s");

  const args = [
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--js-runtimes", "node",
    "--extractor-args", "youtube:player_client=web,web_safari,android_vr",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "--embed-metadata",
    "--restrict-filenames",
    "-o", outputTemplate,
  ];

  if (fs.existsSync(COOKIE_FILE)) {
    args.push("--cookies", COOKIE_FILE);
  }

  args.push(url);

  let stderr = "";
  let stdout = "";

  const proc = spawn("yt-dlp", args, {
    cwd: tempDir,
    env: {
      ...process.env,
      HOME: "/tmp"
    }
  });

  proc.stdout.on("data", d => {
    stdout += d.toString();
    if (stdout.length > 20000) stdout = stdout.slice(-20000);
  });

  proc.stderr.on("data", d => {
    stderr += d.toString();
    if (stderr.length > 20000) stderr = stderr.slice(-20000);
  });

  proc.on("error", err => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return res.status(500).json({
      ok: false,
      error: "Impossible de démarrer yt-dlp.",
      detail: err.message
    });
  });

  proc.on("close", code => {
    if (code !== 0) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      return res.status(502).json({
        ok: false,
        error: fs.existsSync(COOKIE_FILE)
          ? "YouTube a refusé la conversion malgré les cookies."
          : "YouTube demande une authentification. Ajoute cookies.txt comme Secret File dans Render.",
        detail: (stderr || stdout || `yt-dlp exit code ${code}`).trim(),
        cookiesConfigured: fs.existsSync(COOKIE_FILE)
      });
    }

    const files = fs.readdirSync(tempDir)
      .filter(f => f.toLowerCase().endsWith(".mp3"));

    if (!files.length) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      return res.status(500).json({
        ok: false,
        error: "Le MP3 n'a pas été créé.",
        detail: (stderr || stdout).trim()
      });
    }

    const mp3Path = path.join(tempDir, files[0]);
    const downloadName = cleanFilename(files[0].replace(/\.mp3$/i, "")) + ".mp3";

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );

    const stream = fs.createReadStream(mp3Path);
    stream.pipe(res);

    const cleanup = () => {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    };
    res.on("finish", cleanup);
    res.on("close", cleanup);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Radio Shak MP3 API v1.2 on ${PORT}`);
  console.log(`Cookie file: ${COOKIE_FILE}`);
  console.log(`Cookies configured: ${fs.existsSync(COOKIE_FILE)}`);
});