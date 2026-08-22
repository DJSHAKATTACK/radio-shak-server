RADIO SHAK SERVER V1.5 - MULTI-STRATEGY

RADIO SHAK SERVER v1.3 — COOKIES + PO TOKEN

Cette version garde ton endpoint :
https://radio-shak-server.onrender.com/api/mp3
Donc ta page HTML n'a pas besoin de changer.

À REMPLACER DANS TON DÉPÔT GITHUB :
- .dockerignore
- Dockerfile
- package.json
- server.js
- start.sh   <-- nouveau fichier

RENDER :
1) Garde ton service radio-shak-server configuré avec Docker.
2) Dans Environment / Secret Files, garde :
   /etc/secrets/cookies.txt
3) Le fichier cookies.txt doit provenir d'une session YouTube récente où tu es connecté.
4) Ne mets JAMAIS cookies.txt dans GitHub.
5) Fais un nouveau déploiement Render après avoir remplacé les fichiers.

NOUVEAU DANS v1.3 :
- yt-dlp à jour au moment du build.
- Plugin bgutil-ytdlp-pot-provider.
- Fournisseur PO Token local dans le même conteneur Render.
- Client YouTube mweb recommandé pour le PO Token.
- Cookies Render copiés vers /tmp avant utilisation.
- Messages d'erreur plus précis.

TEST APRÈS DÉPLOIEMENT :
Ouvre :
https://radio-shak-server.onrender.com/health

Tu dois voir notamment :
"version":"1.3"
"configured":true
"readable":true
"poTokenProvider":"http://127.0.0.1:4416"

IMPORTANT :
YouTube peut encore bloquer certaines IP de centres de données. Le PO Token améliore la compatibilité mais ne garantit pas qu'une IP Render déjà fortement bloquée sera acceptée. Dans ce cas, réexporte d'abord des cookies frais.

Utilise le téléchargement uniquement pour des contenus que tu as le droit de télécharger.
