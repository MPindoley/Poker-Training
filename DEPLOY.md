# Deploy Felt Academy (free) and put it on your iPhone

Felt Academy is a static web app, with no server and no database. Vercel's free **Hobby** plan hosts it.
It gives you an HTTPS address, which the app needs to install and work offline.

## 1. Put the code on GitHub
The code already lives in `mpindoley/poker-training`. Merge the pull request into `main` first:
Vercel builds the branch you point it at, and `main` is the simplest choice.

## 2. Create the Vercel project (about 5 minutes, one time)
1. Go to **vercel.com** and choose **Sign Up**, then **Continue with GitHub**. Pick the free **Hobby** plan.
2. On the dashboard, click **Add New… → Project**.
3. Under **Import Git Repository**, find `poker-training` and click **Import**.
   If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to that repository.
4. The settings are read from `vercel.json`, so leave them as they are:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: `./`
5. Click **Deploy**. The build takes about a minute.
6. When it finishes you get an address like `https://poker-training-xxxx.vercel.app`. Open it on your
   computer to check that it loads.

Optional: under **Settings → Domains** you can pick a nicer free name such as
`felt-academy.vercel.app`, if nobody has taken it.

### Updates
Every push to `main` redeploys automatically. Pushes to other branches get their own preview addresses,
so `main` stays safe. After a deploy, the app on your phone picks up the new version the next time you
open it twice: once to download, once to switch over.

## 3. Install it on your iPhone
1. Open the Vercel address in **Safari**. It must be Safari: other iPhone browsers can't install web apps.
2. Wait a few seconds on the Home screen while it downloads everything for offline use.
3. Tap the **Share** button (the square with an arrow pointing up) in the toolbar.
4. Scroll down and tap **Add to Home Screen**. On iOS 18+ it may be under **More** (•••) first.
5. Keep the name "Felt Academy", make sure **Open as Web App** is on (iOS 26+), and tap **Add**.
6. Launch it from the new icon. It opens full-screen with no Safari bars and works in airplane mode.

### Good to know
- **Your progress lives on the phone** (IndexedDB), not on Vercel. Deleting the home-screen app or
  clearing Safari website data erases it. To keep a copy, use **Review → Your data → Export JSON**
  regularly, and Import to restore it or move it to a new phone.
- iOS can clear storage for web apps that go unused for several weeks. Opening the app now and then,
  plus the occasional backup, protects you.
- Sound follows the phone's silent switch. Haptics need iOS 18 or later.
- If a new version doesn't appear, close the app fully (swipe it away) and open it again.

## Checking a build locally
```bash
npm ci
npm test            # all unit tests
npm run typecheck
npm run build       # production build + service worker into dist/
npm run preview     # http://localhost:4173 — offline mode works here (localhost counts as secure)
```
