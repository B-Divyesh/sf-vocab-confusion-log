# Independent verification — FAIL (deployment-only)

- Verified at: 2026-08-28 UTC
- Candidate commit: `00c97192f469c4ffe39087e9c4121e92a702afb5`
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Result: **FAIL**. The candidate application is functionally sound, but the live deployment fails the supplied PWA performance caching contract: fingerprinted static JS and CSS are served with `cache-control: public, must-revalidate, max-age=30`, not long-lived immutable caching. This is a hosting/header configuration issue; the deployed product bytes do match the candidate build.

## Clean checkout and quality gates

Ran from the checked-out candidate with Node 22.23.2:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci`: completed; 60 packages audited, zero vulnerabilities.
- `npm test`: passed, 1 file / 7 tests.
- `npm run build`: passed (`tsc --noEmit` and Vite); produced `dist/`.
- `npm run test:e2e`: passed, 12/12 across desktop Chromium and 390 × 844 mobile.
- No separate lint script is declared in `package.json`; TypeScript checking is part of the production build.
- Production bundle: app JS 37,365 B (12,152 B gzip), CSS 21,641 B (5,473 B gzip), hero WebP 107,462 B. Initial JS is well below the 200 KB budget and CSS below 50 KB.
- Fresh local mobile Lighthouse 12.8.2 (full-page screenshot disabled to avoid a Chromium screenshot crash): Performance 90, Accessibility 100, Best Practices 100, SEO 100; LCP 2.0 s, CLS 0, TBT 380 ms. A first attempt crashed only during the Lighthouse full-page-screenshot artifact; the repeat completed with no runtime error.

## Independent product exercise

Separate Playwright checks, in addition to the repository suite, passed on the local production preview:

- Normal flow: logged `affect / effect`, added cue/mnemonic, practised it, recorded a miss, and confirmed the explicit ten-minute recovery state.
- Invalid/recovery flow: rejected normalized equal words (`affect` / `AFFECT`), rejected the reversed duplicate, and preserved the valid pair after reload.
- Audio flow: recorded both sides of `ship / sheep`; confirmed text → audio, then audio → text, including whitespace/case-normalized answer `SHIP`; advanced scheduled due dates only in test data and confirmed resolution exactly on the third clean delayed attempt; exported a CSV containing `ship,sheep`.
- Boundary/recovery flow: seeded the documented eight active pairs and confirmed the ninth-add action routes to the Data/Pro explanation; selected an unsupported JSON backup, accepted the import confirmation, and received the inline recoverable error without a console/page error.
- Local state persisted through refresh. JSON/CSV controls, delete confirmation, legal pages, empty state, and no-audio text route are present.

## Accessibility, privacy, PWA, and responsive checks

- Desktop and 390 px mobile were exercised. At 390 px there was no horizontal overflow; the add flow stayed operable.
- Keyboard-only smoke check passed: first Tab reaches the visible skip link; Enter moves focus to `main`; designed 3 px focus outline is present. Reduced-motion CSS disables transitions/animations and smooth scrolling.
- axe-core scan on the rendered mobile empty desk found zero serious or critical violations. Local and live runs recorded no console errors or page errors.
- First-load request capture showed only same-origin application resources; no analytics, trackers, third-party fonts, or runtime scripts were contacted. The only external endpoint in the built application is the documented Sociobot billing endpoint, used only when a license token is present.
- Service worker: local cache-first offline reload passed; the same offline reload passed on the live URL and showed the offline status. A separate two-version fixture confirmed update detection, the “A fresh version is ready” toast, “Update now”, activation, and controlled reload.
- Manifest includes standalone display, start URL/version query, 192/512/maskable icons, and themed splash colors. Direct `/privacy/` and `/terms/` work locally and live.

## Deployment identity and response evidence

The live response references `app-Bdx7Kc2i.js` and `style-DAzFukb-.css`. SHA-256 comparisons of live versus clean-build files were identical:

| File | SHA-256 |
| --- | --- |
| `index.html` | `01e4aa041c723d3640a289de864f3f614ff082a74f9a7e003af8f9862b84a3d9` |
| `assets/app-Bdx7Kc2i.js` | `c2ec4058378ae5e8321406213c9130816219f15b847a4022ae26245e0e16ee13` |
| `assets/style-DAzFukb-.css` | `798e7c9cb261b8f8911e0313324c6a51fd50e05c8326e9afa75964c8eafca07e` |

Live root, app JS, CSS, service worker, manifest, offline document, privacy, and terms all returned HTTP 200. HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff` are present.

## Defects

### P2 — release blocking: hashed static assets are not immutable-cached

Evidence captured from the live app JS and CSS on 2026-08-28:

```text
cache-control: public, must-revalidate, max-age=30
```

The supplied performance/PWA contract calls for long-lived immutable caching of hashed assets. The paths are fingerprinted (`/assets/app-Bdx7Kc2i.js`, `/assets/style-DAzFukb-.css`) but the host requires revalidation after 30 seconds. Configure the static host/CDN to serve fingerprinted `/assets/*` and immutable icons with a long `max-age` and `immutable`; keep HTML and `sw.js` short-lived/no-cache so updates remain discoverable. This cannot be corrected in this repository because no deployment/headers configuration is versioned here.

### P3 — deployment hardening follow-up

Live responses do not include `Content-Security-Policy`, `Permissions-Policy`, or clickjacking protection (`X-Frame-Options` or CSP `frame-ancestors`). Also, `Strict-Transport-Security` advertises `preload` but has `max-age=10886400` (126 days), below the one-year preload requirement. Add a restrictive static-site CSP (including the required billing `connect-src`), a microphone-only Permissions-Policy as appropriate, frame protection, and either a valid preload-duration HSTS policy or remove `preload`.

## Handoff condition

Do not mark this deployment released until the P2 caching header is corrected and rechecked. No product-code change is requested or made by this verification.
