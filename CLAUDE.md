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
1. **ALWAYS `git pull origin main` first** — ensure local matches what's live before any edits
2. Edit files locally
3. Commit changes
4. Push to `main` (`git push origin main`)
5. Railway auto-deploys (~1-2 min) — verify on https://prospector.efelle.com/

## Preview
- Do NOT use local preview — Express caching serves stale files and is unreliable.
- Always verify changes on the live site after pushing.

## Key directories
- `public/` — All frontend files (HTML, CSS, JS, images)
- `public/js/engines/` — Individual tool engines (wsr.js, cca.js, etc.)
- `public/js/core/` — Shared modules (reports, changelog, debug)
- `public/assets/img/` — Images including login backgrounds
- `data/` — Runtime data storage
- `server.js` — Express server, API proxy, auth, Gemini orchestration
