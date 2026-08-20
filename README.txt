RADIO SHAK SERVER v1.2

1) Remplace dans GitHub les 4 fichiers :
   - .dockerignore
   - Dockerfile
   - package.json
   - server.js

2) Commit directement dans main.
   Render va redéployer automatiquement.

3) Dans Render, ouvre radio-shak-server.
   Va dans Environment / Secret Files (le libellé peut varier selon l'interface).

4) Ajoute un Secret File :
   Filename / path : cookies.txt
   Render doit le monter à :
   /etc/secrets/cookies.txt

5) Colle le contenu de ton fichier cookies.txt exporté depuis un navigateur
   où tu es connecté à YouTube.

IMPORTANT :
- Ne mets JAMAIS cookies.txt dans GitHub.
- Ne partage pas cookies.txt.
- Les cookies peuvent expirer ; il faudra parfois les réexporter.
- Utilise le téléchargement seulement pour du contenu que tu as le droit de télécharger.

Test :
https://radio-shak-server.onrender.com/

La réponse doit contenir :
"version":"1.2"
et idéalement :
"cookiesConfigured":true
