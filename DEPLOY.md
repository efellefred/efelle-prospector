# Deployment

**Platform:** Railway
**Live URL:** https://prospector.efelle.com
**GitHub:** https://github.com/efellefred/efelle-prospector
**Container:** `Dockerfile` at repo root (Node + Express + Puppeteer + Helmet)
**Auto-deploy:** push to `main` (deploy config lives in the Railway dashboard, not in this repo)

**Why Railway, not Vercel:** Puppeteer + long-running scrapes need a real container. Won't run on Vercel's serverless runtime without a major rewrite.

Full context: [`C:\Users\fl\Desktop\AI\apps\DEPLOYMENTS.md`](../DEPLOYMENTS.md)
