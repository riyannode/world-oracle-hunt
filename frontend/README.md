# World Oracle Hunt — Frontend

Static HTML + JS frontend that talks to the deployed Intelligent Contract on
GenLayer Testnet Bradbury.

- `public/index.html` — UI (Tailwind via CDN, no build needed)
- `public/app.js` — application logic (read state, connect MetaMask, predict)
- `public/genlayer.bundle.js` — bundled `genlayer-js` SDK for browser (528 kB,
  built from `genlayer-entry.js` with `esbuild`)
- `genlayer-entry.js` — bundle entry point
- `package.json` — only needed if you want to rebuild the bundle

## Run locally

```bash
cd frontend/public
python3 -m http.server 8000
# open http://localhost:8000
```

## Rebuild the SDK bundle (optional)

```bash
cd frontend
npm install
npx esbuild genlayer-entry.js --bundle --format=iife --target=es2020 \
  --outfile=public/genlayer.bundle.js --minify
```

## Deploy

Vercel: import this repo, set **Root Directory** = `frontend/public`,
**Framework Preset** = `Other`, no build command, output = `.`.

The deployed contract address is hard-coded in `app.js` (`CONFIG.contract`).
