# AOS - Authorised Optical Service

Folder structure:
- public/index.html   -> page (HTML)
- public/css/style.css -> design (CSS)
- public/js/app.js    -> frontend logic (JavaScript)
- src/worker.js       -> backend API (Cloudflare Worker + R2)
- wrangler.jsonc      -> Cloudflare config (R2 bucket: aos-files)

Run locally (VS Code terminal):
  npx wrangler dev

Push to GitHub:
  git add .
  git commit -m "aos cloud"
  git push
