# efelle Prospector

## What is this?
Internal sales tool for efelle creative. Modular app with website audit, strategy builder, action plan, and proposal engines. Built with Node/Express, served as static HTML + JS with an API proxy layer.

## Stack
- **Backend**: Node.js + Express (server.js)
- **Frontend**: Vanilla HTML/CSS/JS in `public/`
- **Screenshots**: Puppeteer (Chromium)
- **Deployment**: Docker on Railway (auto-deploys on push to `main`)

## Hosting & Deployment
- **Repo**: `efellefred/efelle-prospector` on GitHub
- **Live URL**: https://prospector.efelle.com/
- **Deploy process**: Push to `main` triggers automatic Railway deploy. No manual steps needed.
- After pushing, Railway rebuilds the Docker image and redeploys. Takes ~1-2 minutes.

## Workflow for making changes
1. Edit files locally
2. Commit changes
3. Push to `main` (`git push origin main`)
4. Railway auto-deploys — verify on https://prospector.efelle.com/

## Local preview
- Run `node server.js` (port 3000)
- Note: Express static file caching can cause stale content locally. Restart the server after file changes.

## Key directories
- `public/` — All frontend files (HTML, CSS, JS, images)
- `public/js/engines/` — Individual tool engines (wsr.js, cca.js, etc.)
- `public/js/core/` — Shared modules (reports, changelog, debug)
- `public/assets/img/` — Images including login backgrounds
- `data/` — Runtime data storage
- `server.js` — Express server, API proxy, auth, Gemini orchestration
