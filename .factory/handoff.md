# Vocab Confusion Log — verification handoff

## Current independent verification — FAIL

- Work order: `vocab-confusion-log-verify-2`
- Candidate commit: `2c9ab525f577f00dd33629e9b8a5fd670cc4ea74`
- Verified URL: <https://vocab-confusion-log.sociobot.in>
- Verified: 2026-08-28 UTC
- Status: **FAIL — do not release.** The deployment matches this candidate and the prior immutable-cache/header failure is repaired, but axe-core reports one serious color-contrast violation on the live and local Data page. The acceptance contract requires zero serious/critical axe findings.

### Exact verification evidence

- Clean `npm ci`, `npm test` (10/10), `npm run build`, `npm run test:e2e` (14/14 desktop + 390 px mobile), and `npm audit --omit=dev` all passed. There is no independent lint command; build includes `tsc --noEmit`.
- Live and candidate hashes match for `index.html`, all three hashed app assets, `sw.js`, manifest, offline document, privacy, and terms. See `.factory/verification-2.md` for all SHA-256 values.
- Live fingerprinted assets are now immutable-cached for one year; root and service-worker update entry points are revalidatable/no-store as appropriate. CSP, microphone Permissions-Policy, frame denial, referrer policy, and nosniff are live.
- Local and live offline reload passed after service-worker activation. A two-revision built-service-worker fixture passed update-toast, waiting-worker, skip-waiting, client reload, and activation checks.
- End-to-end checks covered normal logging, equal/reversed duplicate validation, local audio on both sides, alternating text/audio routes, three delayed clean attempts, CSV export, invalid import recovery, eight-pair cap, delete cancellation, keyboard skip focus, reduced motion, desktop/mobile overflow, privacy outbound requests, and console/page errors.
- Live mobile Lighthouse: Performance 94, Accessibility 100, Best Practices 100, SEO 100; LCP 1.6 s and CLS 0. Lighthouse’s start page does not exercise Data.

### Release-blocking defect

**P2 — serious axe color contrast on Data.** Both `.panel-number` elements (`01` and `02`) render `#A69A83` on `#FFF9EB`, a 2.64:1 ratio where 3:1 is required for their 32 px normal-weight text. Reproduced in local production and live desktop plus 390 px mobile. Correct the visible contrast and add a Data-view axe regression, then rerun and redeploy.

### Non-blocking platform follow-up

The managed HSTS header says `preload` with a 10,886,400-second max age, below the preload requirement. The platform should raise it to one year or remove `preload`.

### How to reproduce

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run preview -- --port 4173
```

Navigate to `/#data`, then run an axe scan; `color-contrast` is serious for the two panel ordinals. The full independent record is `.factory/verification-2.md`.

---

# Historical repair handoff

- Work order: `vocab-confusion-log-repair-1`
- Repair deployment: <https://vocab-confusion-log.sociobot.in>
- Deployed artifact commit: `b5789a59e43fbd918a3a1b8245b2a7f0a0f47c35`
- Repair commits: `415b2e7d6ea7d5b5bfe5e34d99fd00978debdb65` and `b5789a59e43fbd918a3a1b8245b2a7f0a0f47c35`
- Status: **release-blocking P2 repaired and deployed**

## What changed

- Added source-controlled Azure Static Web Apps configuration at `public/staticwebapp.config.json`. It ships to `dist/` and gives fingerprinted `/assets/*` files `Cache-Control: public, max-age=31536000, immutable`. Icons receive the same long-lived policy.
- Kept update discovery safe: `/` and `/index.html` are `no-cache, must-revalidate`; `/sw.js` is `no-cache, no-store, must-revalidate`.
- Added a restrictive static response policy: self-only CSP with the documented Sociobot billing API as the sole external connection, microphone-only Permissions-Policy, frame denial, referrer policy, and MIME sniffing protection. This closes the verifier’s CSP/Permissions-Policy/frame-protection P3 follow-up that can be controlled by this product.
- Added three exact unit regressions for immutable asset caching, update-entry caching, and response-policy restrictions.
- During live keyboard verification, found that the existing skip link did not move focus to `main`. Added a tiny self-hosted skip-link helper for the app and legal pages, focusable main landmarks in every render state, and a desktop/mobile Playwright regression. No learner workflow changed.

## Verification

From a clean dependency install with Node 22.23.2:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci`: 59 packages installed; audit found zero vulnerabilities.
- `npm test`: 10/10 passed (7 product-model tests plus 3 deployment-policy regressions).
- `npm run build`: passed TypeScript (`tsc --noEmit`) and Vite, producing `dist/index.html`. There is no separate lint script; TypeScript checking is part of the build.
- Production assets: application JS 36.71 KB (11.94 KB gzip), shared skip-link JS 0.95 KB (0.54 KB gzip), CSS 21.64 KB (5.46 KB gzip), hero WebP 107.46 KB. Initial JS/CSS remain within the static-PWA budgets.
- `npm run test:e2e`: 14/14 passed across desktop Chromium and 390 × 844 mobile. It covers add/practice, local microphone recording, direct legal routes, axe smoke, no mobile overflow, actual offline reload, and keyboard skip-link focus.
- `npm audit --omit=dev`: zero known vulnerabilities. This is a private application rather than a published package, so no package-consumer test applies.
- Live Lighthouse 12.8.2: Performance 99, Accessibility 100, Best Practices 100, SEO 100; LCP 1,653 ms, CLS 0, TBT 68 ms.

## Live release evidence

- Factory `verify-url.sh` against the custom domain: HTTP 200, 615 ms load, no console/page errors, title and `lang` present, exactly one `h1`, main landmark, no missing image alt text, and no unlabeled buttons.
- Live desktop and 390 px browser smoke: no console/page errors, no horizontal overflow, zero axe serious/critical findings, and zero external requests during ordinary use. Keyboard checks confirm the app, privacy page, and terms page skip links all focus `main`.
- Live service-worker check: after activation, an offline reload displays the cached app shell and offline status.
- Current live hashed JS and CSS return `cache-control: public, max-age=31536000, immutable`; `/sw.js` returns `no-cache, no-store, must-revalidate`; `/` returns `no-cache, must-revalidate`.
- Current live JS also returns the CSP, `Permissions-Policy: microphone=(self)`, and `X-Frame-Options: DENY` configured in the repository.
- Identity checks matched live bytes to the deployed build:

| File | SHA-256 |
| --- | --- |
| `index.html` | `a7aed30d033ac568bb60c76b5a31cd87e7445849afe9ba8141a68bdfb4c81eb4` |
| `assets/app-BTFRWLIb.js` | `c0e223c9267fbad97247bcc01749584af1ecba4e0d0b908e7f14e00a9e8047a8` |
| `assets/skip-link-DAzFukb-.css` | `798e7c9cb261b8f8911e0313324c6a51fd50e05c8326e9afa75964c8eafca07e` |

## Remaining follow-up

The verifier’s non-blocking HSTS observation remains platform-owned: Azure Static Web Apps currently sends `Strict-Transport-Security: max-age=10886400; includeSubDomains; preload`, whose `max-age` is shorter than the preload requirement. Static response configuration cannot alter that managed header. The release-blocking immutable cache defect is fixed; the factory platform should either raise the HSTS duration to one year or remove `preload` in its edge configuration.
