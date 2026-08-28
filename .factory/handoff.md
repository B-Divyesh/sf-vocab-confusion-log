# Vocab Confusion Log — build handoff

> Independent verification status (2026-08-28): **FAIL — deployment-only.** Commit `00c97192f469c4ffe39087e9c4121e92a702afb5` builds and functions end to end, and the live application at <https://vocab-confusion-log.sociobot.in> is byte-identical to its built HTML/JS/CSS. Release is blocked because the live host serves fingerprinted static assets with `cache-control: public, must-revalidate, max-age=30`, which fails the required long-lived immutable-cache policy. See [.factory/verification.md](verification.md) for exact tests, hashes, and response evidence. No product code was modified by the verifier.

- Work order: `vocab-confusion-log-build-1`
- Completed: 2026-08-27
- Deploy type: static; output root: `dist/`

## What was built

- A complete local-first confusion log backed by IndexedDB. Learners can add, edit, search, and delete paired words; attach a contrast cue, mnemonic, language, and optional own-voice recordings; and inspect full attempt history.
- A focused repair loop that alternates text → audio and audio → text when both recordings exist. It schedules clean returns after one and three days, resolves on the third clean due attempt, and brings misses back after ten minutes.
- Honest audio handling: recordings are made only after an explicit microphone action, remain local, can be replayed/removed, and are never scored or uploaded.
- JSON backup/restore including recordings, plus CSV export of resolved pairs. These data-ownership features are not paywalled.
- A useful free tier (eight active pairs; resolved pairs do not count) and a US$9 one-time Pro unlock for unlimited active pairs. Checkout and verification use the Sociobot contract, returned tokens are stripped from the URL, verdicts are cached, offline access is optimistic from a valid cache, and licenses can be pasted to restore. `VITE_BILLING_BASE_URL` can override the production default without changing code.
- An installable PWA with generated 192/512/maskable icons, a versioned app-shell cache, network-first navigation, cache-first local assets, an offline fallback, and an in-app update prompt.
- `/privacy/` and `/terms/`, MIT licensing, robots/sitemap files, and a complete README.
- A product-specific tactile risograph system. The generated illustration source, prompt, review note, and optimized 108 KB WebP are retained with provenance in `.factory/design.md` and `assets/src/`.

## Verification

Run from a clean checkout with Node.js 20+:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Results on 2026-08-27:

- `npm test`: 7/7 Vitest checks passed.
- `npm run build`: passed; generated `dist/index.html`. Initial assets: 37.37 KB JS (12.21 KB gzip), 21.64 KB CSS (5.46 KB gzip), 107.46 KB hero WebP. No runtime fonts.
- `npm run test:e2e`: 12/12 Playwright checks passed across desktop Chromium and a 390 × 844 mobile viewport. Coverage includes add/practice, fake-device microphone capture and persistence, axe scan, no horizontal overflow, direct legal routes, and an actual offline reload.
- Factory `verify-url.sh`: HTTP 200, zero console/page errors, title and `lang` present, exactly one `h1`, main landmark present, no missing image alt text, no unlabeled buttons; measured load 558 ms locally.
- Lighthouse 12.8.2 mobile profile: Performance 99, Accessibility 100, Best Practices 100, SEO 100; LCP 2.0 s, CLS 0, Total Blocking Time 50 ms, Speed Index 0.9 s.
- `npm audit`: zero known vulnerabilities.

## Known gaps and release notes

- The factory still needs to register the production billing product and ensure its configured price is US$9 before release. The code intentionally contains no provider product ID; it uses the required product slug endpoint.
- MediaRecorder output format is browser-selected. Current Chromium, Firefox, and Safari releases support the path, while browsers without MediaRecorder fall back cleanly to text → audio self-assessment.
- The one-day and three-day waits are covered by deterministic unit tests; the browser suite tests the first scheduled attempt rather than waiting real days.
- Imported/teacher audio is intentionally not offered in v1 because rights cannot be established locally. Learners can record their own references.
- Lighthouse was run against the local production preview; CDN/edge configuration is owned by deployment and should be rechecked after release.
