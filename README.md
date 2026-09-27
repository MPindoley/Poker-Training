# Felt Academy

A mobile-first poker training PWA for No-Limit Hold'em: odds, equity, ranges, bet sizing and value betting,
built to feel like a mobile game. See `CLAUDE.md` for the full brief.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 plus a Network URL for your phone
npm test           # engine unit tests
npm run build && npm run preview   # production build with offline support
```

### Open it on your phone (same Wi-Fi)
1. Run `npm run dev` on your computer. Vite prints a line like `Network: http://192.168.1.23:5173/`.
2. On the iPhone (same Wi-Fi), open that URL in Safari.
3. If it doesn't load, allow Node through your computer's firewall (macOS: System Settings → Network → Firewall).

Offline mode and the service worker only work on `localhost` or over HTTPS. To install it properly
(home screen + offline), deploy the `dist/` folder to any static HTTPS host (Netlify, Vercel, GitHub Pages,
Cloudflare Pages), open it in Safari, then Share → **Add to Home Screen**.
