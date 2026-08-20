const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors({ origin: true, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '32kb' }));

function isYouTubeUrl(value){
  try{
    const u = new URL(value);
    return ['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be','music.youtube.com'].includes(u.hostname);
  }catch{return false;}
}

app.get('/', (_req,res) => res.json({ok:true, service:'Radio Shak MP3 API'}));
app.get('/health', (_req,res) => res.json({ok:true}));

app.post('/api/mp3', (req,res) => {
  const url = String(req.body?.url || '').trim();
  if(!isYouTubeUrl(url)) return res.status(400).json({error:'Lien YouTube invalide.'});

  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'radioshak-'));
  const template = path.join(dir, '%(title).120B.%(ext)s');
  const args = [
    '--no-playlist',
    '--no-progress',
    '--extract-audio',
    '--audio-format','mp3',
    '--audio-quality','0',
    '--restrict-filenames',
    '-o',template,
    url
  ];

  const p = spawn('yt-dlp', args, { stdio:['ignore','ignore','pipe'] });
  let err='';
  p.stderr.on('data', d => { err += d.toString(); if(err.length > 8000) err = err.slice(-8000); });

  const cleanup = () => { try{ fs.rmSync(dir,{recursive:true,force:true}); }catch{} };
  req.on('close', () => { if(!res.writableEnded){ try{p.kill('SIGTERM');}catch{} cleanup(); } });

  p.on('error', () => { cleanup(); if(!res.headersSent) res.status(500).json({error:'yt-dlp n’est pas disponible sur le serveur.'}); });
  p.on('close', code => {
    if(res.headersSent || res.writableEnded) return;
    if(code !== 0){ cleanup(); return res.status(500).json({error:'Conversion impossible. '+err.slice(-500)}); }
    const file = fs.readdirSync(dir).find(f => f.toLowerCase().endsWith('.mp3'));
    if(!file){ cleanup(); return res.status(500).json({error:'Fichier MP3 introuvable après conversion.'}); }
    const full = path.join(dir,file);
    res.download(full,file,cleanup);
  });
});

const port = process.env.PORT || 3000;
app.listen(port,'0.0.0.0',()=>console.log(`Radio Shak MP3 API on ${port}`));
