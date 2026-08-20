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

app.get('/', (_req,res) => res.json({ok:true, service:'Radio Shak MP3 API', version:'1.1'}));
app.get('/health', (_req,res) => res.json({ok:true, version:'1.1'}));

app.post('/api/mp3', (req,res) => {
  const url = String(req.body?.url || '').trim();
  if(!isYouTubeUrl(url)) return res.status(400).json({error:'Lien YouTube invalide.'});

  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'radioshak-'));
  const template = path.join(dir, '%(title).120B.%(ext)s');

  const args = [
    '--no-playlist',
    '--no-progress',
    '--force-ipv4',
    '--retries','3',
    '--fragment-retries','3',
    '--js-runtimes','node',
    '--remote-components','ejs:github',
    '--extractor-args','youtube:player_client=web_embedded,android_vr',
    '-f','bestaudio/best',
    '--extract-audio',
    '--audio-format','mp3',
    '--audio-quality','0',
    '--restrict-filenames',
    '-o',template,
    url
  ];

  const p = spawn('yt-dlp', args, { stdio:['ignore','pipe','pipe'] });
  let err='';
  let out='';
  p.stdout.on('data', d => { out += d.toString(); if(out.length > 6000) out = out.slice(-6000); });
  p.stderr.on('data', d => { err += d.toString(); if(err.length > 12000) err = err.slice(-12000); });

  const cleanup = () => { try{ fs.rmSync(dir,{recursive:true,force:true}); }catch{} };

  p.on('error', e => {
    cleanup();
    if(!res.headersSent) res.status(500).json({error:'Impossible de démarrer yt-dlp.', detail:String(e.message||e)});
  });

  p.on('close', code => {
    if(res.headersSent || res.writableEnded) return;
    if(code !== 0){
      const detail = (err || out || 'yt-dlp a quitté avec le code '+code).slice(-1800);
      cleanup();
      return res.status(500).json({error:'Conversion impossible.', detail});
    }

    let file;
    try{ file = fs.readdirSync(dir).find(f => f.toLowerCase().endsWith('.mp3')); }catch{}
    if(!file){
      const detail = (err || out || 'Aucun fichier MP3 créé.').slice(-1800);
      cleanup();
      return res.status(500).json({error:'Fichier MP3 introuvable après conversion.', detail});
    }

    const full = path.join(dir,file);
    res.download(full,file,cleanup);
  });
});

const port = process.env.PORT || 10000;
app.listen(port,'0.0.0.0',()=>console.log(`Radio Shak MP3 API v1.1 on ${port}`));
