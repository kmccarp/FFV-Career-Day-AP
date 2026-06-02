# FFV Career Day — Manual Tracker (Android / mobile web)

A standalone, **manual-entry** tracker for *Final Fantasy V: Career Day (AP)*.
No Archipelago connection — you tap things yourself. It's a mobile-first web app
(installable PWA) built from the same images and item/job/boss data as the
PopTracker pack in this repo.

## What it does

- **Tap to track** Key Items, Jobs (career-day crystals), Bosses, and Events.
  - Items/jobs/events: tap to toggle on/off.
  - Bosses: tap to mark defeated (adds a ✓ badge).
  - Pianos counter: tap to add one; tapping past 8 wraps back to 0.
    Long-press (or right-click) subtracts one.
- **Long-press any item/boss** to pop up its name and, for bosses, the
  **vanilla location** where it's found in FFV (e.g. "Gargoyle — Great Sea
  Trench"). Boss names/locations are pulled straight from the pack's location
  data, with the non-randomized bosses filled in from the FFV wiki.
- **Saves after every change** to the browser's local storage.
- **Auto-loads** your last saved state every time you open it.
- **Clear** button in the top-right wipes everything, behind a confirmation dialog.

State lives entirely on your device (localStorage). Nothing is uploaded.

## Use it on your Android phone

**Option A — host it (recommended, installs like an app):**
1. Serve this repo over HTTPS. The easiest is GitHub Pages: in the repo settings
   enable Pages for this branch, root folder.
2. On your phone open `…/android/index.html`.
3. Chrome menu → **Add to Home screen**. It installs as a standalone app with an
   icon, runs full-screen, and works offline (the app shell is cached by
   `sw.js`; images cache as you view them).

**Option B — sideload the files:**
Copy the `android/` folder **and** the repo's `images/` folder onto the phone
(keep them as siblings — the app references `../images`). Open
`android/index.html` in a browser. Toggling and save/load still work over
`file://`; only the installable/offline-cache extras need hosting.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell + clear-confirmation dialog |
| `styles.css` | Dark, mobile-first styling |
| `app.js` | Rendering, toggles, counter, localStorage save/load, clear flow |
| `data.js` | Auto-generated tracker data (items/jobs/bosses/events) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA install + offline shell |
| `build-data.js` | Regenerates `data.js` from the pack's `items/*.json` |
| `build-icons.js` | Regenerates the app icons |
| `test/verify.js` | Playwright test driving the app on an emulated Pixel 5 |

## Regenerate / test

```bash
node android/build-data.js          # rebuild data.js from the pack JSON
node android/build-icons.js         # rebuild icons
# serve the repo root, then:
python3 -m http.server 8099 &
BASE=http://localhost:8099/android/index.html node android/test/verify.js
```

The test verifies rendering (no broken images), tap-to-toggle, the piano
counter, save-after-every-change, auto-load on reload, and the
clear → confirm/cancel flow.
