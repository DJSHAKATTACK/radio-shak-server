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
    let content = fs.readFileSync(COOKIE_FILE, "utf8");

    // Enlève BOM éventuel et normalise les retours de ligne Windows.
    content = content
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    // Corrige les espaces accidentels ajoutés devant les lignes
    // lors du copier-coller dans Render.
    const lines = content.split("\n").map(line => {
      // Les commentaires Netscape doivent commencer exactement par #
      if (/^\s+#/.test(line)) {
        return line.replace(/^\s+/, "");
      }

      // Enlève seulement les espaces accidentels avant les domaines.
      if (/^\s+(\.?youtube\.com|\.?google\.com)/i.test(line)) {
        return line.replace(/^\s+/, "");
      }

      return line;
    });

    content = lines.join("\n").trim() + "\n";

    // Vérification du format Netscape.
    if (!content.startsWith("# Netscape HTTP Cookie File")) {
      throw new Error(
        "cookies.txt invalide : la première ligne doit être exactement '# Netscape HTTP Cookie File'"
      );
    }

    fs.writeFileSync(WRITABLE_COOKIE_FILE, content, {
      encoding: "utf8",
      mode: 0o600
    });

    console.log(
      `Cookies préparés correctement : ${WRITABLE_COOKIE_FILE} (${Buffer.byteLength(content)} bytes)`
    );

    return WRITABLE_COOKIE_FILE;

  } catch (e) {
    console.error("Erreur préparation cookies:", e.message);
    return null;
  }
}
