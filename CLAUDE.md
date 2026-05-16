# helpme — Deployment Guide

## Stack
Expo React Native Web app, served as a static site via `serve`.

## GitHub
Remote: https://github.com/sabachiburashka7-source/helpme.git
Branch: main

## Render
- Service type: Web Service
- Build Command: *(empty — dist is pre-built and committed)*
- Start Command: `npm run serve`
- The `dist/` folder is committed to git and served directly.

## Deploying changes
1. Make code changes
2. Run `npm run build` to rebuild the dist folder
3. Commit everything including `dist/`
4. Push to GitHub — Render auto-deploys on push to main

```
npm run build
git add .
git commit -m "your message"
git push
```
