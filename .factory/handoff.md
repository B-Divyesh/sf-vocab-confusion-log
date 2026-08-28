# Vocab Confusion Log — repair handoff

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
