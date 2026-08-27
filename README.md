# Vocab Confusion Log

Vocab Confusion Log is a local-first PWA for language learners who keep mixing up the same near-neighbor words. Instead of making another deck, log the exact pair, add one contrast cue and optional mnemonic, record your own pronunciation, then alternate between text → audio and audio → text retrieval.

A pair resolves after three clean scheduled attempts: immediately, one day later, and three days after that. A miss resets the clean run and returns in ten minutes. This is repair history, not a proficiency score.

Live product: <https://vocab-confusion-log.sociobot.in>

## What ships

- IndexedDB storage for pairs, notes, local recordings, due dates, and attempt history
- Text → audio self-checks and exact audio → text production checks
- Three-clean-attempt resolution workflow with visible history
- Full JSON backup/import, including recordings, plus CSV export of resolved pairs
- Installable offline shell with update notification and 192/512/maskable icons
- Responsive keyboard and 390 px mobile paths, reduced-motion support, and legal pages
- Free tier with eight active pairs; US$9 one-time Pro license removes that cap

The Pro purchase uses Sociobot’s hosted billing and license verification API. No payment provider or card handling is embedded in this repository. Set `VITE_BILLING_BASE_URL` only when the factory needs a non-production billing API; the default is `https://api.sociobot.in`.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
```

Vite prints the local URL. Microphone recording requires localhost or HTTPS and explicit browser permission.

## Test and build

```sh
npm test
npm run build
npm run test:e2e
```

`npm run build` is the deployment command. It type-checks the project and writes the static site to `dist/`, with `dist/index.html` at its root. The Playwright suite uses the factory-pinned Chromium from Playwright 1.58.2 and checks the real add/practice path, axe accessibility, 390 px layout, direct legal routes, and an offline reload.

## Data and privacy

Ordinary use makes no network requests beyond loading the app. Word pairs and recordings remain in the browser. JSON backup is the portable source of truth; clearing site storage without a backup permanently removes local data. A license token is kept in `localStorage` and is sent only to Sociobot’s verify endpoint at most once per day. See [/privacy](https://vocab-confusion-log.sociobot.in/privacy/) and [/terms](https://vocab-confusion-log.sociobot.in/terms/).

There are no analytics, advertising cookies, third-party fonts, or runtime CDN scripts. Record only your own voice or audio you have rights to use.

## Project map

- `src/main.ts` — UI, recording flow, practice interactions, import/export, update handling
- `src/db.ts` — IndexedDB persistence and JSON backup codec
- `src/model.ts` — pure scheduling, answer, duplicate, and CSV logic
- `src/license.ts` — one-time purchase return, cached verification, restore flow
- `src/sw-template.js` — generated-cache offline strategy
- `.factory/design.md` — visual system and original asset provenance
- `.factory/handoff.md` — verification evidence and release notes

## License

MIT. See [LICENSE](./LICENSE).
