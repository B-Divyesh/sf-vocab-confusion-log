# Vocab Confusion Log

Vocab Confusion Log is a local-first PWA for language learners who repeatedly confuse the same words. Log the pair, add one contrast cue, and optionally record your own pronunciation. The app switches between text → audio and audio → text practice when both recordings exist.

A pair resolves after three clean scheduled attempts: immediately, one day later, and three days after that. A miss resets the clean run and returns in ten minutes. This is practice history, not a proficiency score.

Live product: <https://vocab-confusion-log.sociobot.in>

One-click sample: <https://vocab-confusion-log.sociobot.in/demo/>

## What ships

- Browser storage for pairs, notes, recordings, due dates, and attempt history
- Text → audio and audio → text practice when both recordings exist
- Resolution after three scheduled correct attempts
- JSON backup and restore, including recordings
- CSV export with one row per resolved pair
- Installable offline shell with an in-app update action
- Eight active pairs for free; a US$9 one-time Pro license removes that limit

The Pro purchase uses Sociobot’s hosted billing and license verification API. New checkout is pending product registration. Existing license restore remains implemented, and the free app remains usable. No payment provider or card handling is embedded here.

## Run locally

Requires Node.js 20.19 or newer.

```sh
npm ci
npm run dev
```

Vite prints the local URL. Microphone recording requires localhost or HTTPS and explicit browser permission.

Open `/demo/` for the isolated sample. Its IndexedDB database and license keys use a `demo:` prefix. **Reset demo** restores the sample, and **Start for real** clears demo data before opening `/log/`.

## Test and build

```sh
npm test
npm run build
npm run test:e2e
npm run test:claims
npm audit --omit=dev
```

`npm run build` type-checks the project and writes the static site to `dist/`. The browser suite checks the real workflow, routes, keyboard, mobile layout, metadata, 404, and accessibility. The claims suite runs every command declared in `.factory/claims.json` against `/demo/`.

## Deploy

Run `npm run build`, then publish the complete `dist/` directory to the product’s static host. Keep `staticwebapp.config.json` at the deployment root so known app routes, security headers, caching, and the HTTP 404 response remain active.

## Data and privacy

Ordinary logging and practice make only same-origin requests. Word pairs and recordings remain in the browser. JSON backup includes local records and recordings. Clearing site storage without a backup permanently removes that data. License verification is the only optional request to `api.sociobot.in`. See [/privacy](https://vocab-confusion-log.sociobot.in/privacy/) and [/terms](https://vocab-confusion-log.sociobot.in/terms/).

There are no analytics, advertising cookies, third-party fonts, or runtime CDN scripts. Record only audio you have rights to use.

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
