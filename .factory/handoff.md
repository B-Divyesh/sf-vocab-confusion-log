# Vocab Confusion Log — repair 3 handoff

- Work order: `vocab-confusion-log-repair-3`
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Deployed implementation SHA: `cad4040b15dd493a8b355f3110b8c2b8193af963`
- Deployment date: 2026-09-06 UTC
- Documentation: this later report-only commit; the implementation SHA above is the live product candidate
- Strict status: **PASS** — 0 findings and 0 untested public claims

## What changed

- Added a job-led landing page with the learner, task, sample action, privacy, offline behavior, and price visible before scrolling.
- Moved personal data to `/log/` and added real Practice, Pairs, and Data URLs with titles, canonicals, focus movement, and back-button behavior.
- Added a one-click `/demo/` with three realistic pairs, generated spoken references, a persistent demo label, Reset demo, and Start for real.
- Isolated demo pairs, attempts, and license state under `demo:` storage. Reset restores the sample and clears demo licensing. Exit discards demo state without reading or changing personal IndexedDB.
- Added `.factory/claims.json` with 12 public claims and exactly one outcome-based browser test per claim.
- Added a product-styled HTTP 404. Explicit valid app routes open normally; top-level and nested unknown routes return 404.
- Completed titles, descriptions, canonicals, Open Graph/Twitter metadata, the 1200 × 630 social image, the Apple touch icon, sitemap, and security headers.
- Added the standard landing sections, consistent public header plus a separate app subnavigation, legal pages, plain-language copy audit, demo documentation, catalog description, and billing metadata.
- Made every visible control at least 44 × 44 px and kept the populated sample within the first 390 × 844 demo screen.
- Added trimmed required-field validation with announced, field-linked errors and focused recovery.
- Enforced the eight-active-pair free limit for both manual entry and merged JSON restores. A valid Pro license permits entry and restore above eight.
- Corrected the service worker so valid screens reload offline, unknown uncached URLs use the offline fallback, and an activated update is observable.
- Corrected HSTS to `max-age=31536000; includeSubDomains; preload` and preserved immutable hashed-asset caching.

## Review-2 disposition

| Finding | Disposition |
| --- | --- |
| No one-click isolated demo | Fixed. `/demo/` is populated, labelled, resettable, and isolated from `/log/`. |
| Missing claims contract and 11 untested claims | Fixed. The original 11 plus the separately discovered ten-minute miss claim are listed and tested; untested count is 0. |
| First screen and metaphor-heavy copy | Fixed. The H1 is “Practise the words you mix up”; the audience, action, and three facts fit before scrolling. |
| Missing landing/site skeleton | Fixed. Landing, preview, three steps, scope/privacy, price, footer, and consistent site navigation are present. |
| Unknown routes showed the app | Fixed. `/no-such-route`, `/log/not-a-real-route`, and `/demo/not-a-real-route` return the designed HTTP 404. |
| Incomplete route metadata | Fixed. Every public and nested route has its own title/canonical and complete sharing metadata; the sitemap lists every valid route. |
| Earlier HSTS advisory | Fixed. The live header uses a preload-compatible one-year duration. |

Earlier immutable-cache and Data-panel contrast fixes remain intact. The final independent strict review also checked the mobile demo, touch targets, header consistency, claim rigor, reset semantics, import boundary, whitespace validation, install metadata, nested 404s, and offline fallback. It returned PASS with no remaining code finding.

## Verification

From detached clean checkout `/tmp/vcl-final-7P4qLe` at the implementation SHA with Node 22.23.2:

```sh
npm ci
npm test
npm run build
npm run test:e2e
# Every `test` command in .factory/claims.json was then run separately.
npm audit --omit=dev
```

Results:

- Unit and deployment policy: 12/12 passed.
- Browser regression suite: 20/20 passed across desktop Chromium and 390 × 844 mobile.
- Claims: all 12 declared commands passed individually from the clean checkout.
- Production audit: 0 vulnerabilities.
- Build: `dist/` produced; landing JS 4.91 KB, app JS 43.49 KB, CSS 27.22 KB, and hero WebP 107.46 KB uncompressed.
- Independent strict review: PASS; 0 findings and 0 untested public claims.

Final live checks:

- The root, Demo, all six nested app screens, Privacy, Terms, sitemap, robots, manifest, and service worker return 200.
- Top-level and nested invalid paths return intentional HTTP 404 responses with the designed recovery page.
- Live HTML, service worker, manifest, sitemap, and hashed JS/CSS bytes match the clean `dist/` exactly.
- The factory URL verifier found one H1, `lang=en`, a main landmark, no missing alt text, no unlabeled buttons, and no console errors.
- Fresh desktop and phone sessions showed the job, audience, and sample action before scrolling. The sample pair ended at 704 px of 1000 px desktop and 744 px of 844 px phone.
- Demo reset, personal-data isolation, Start for real, same-origin ordinary requests, offline demo reload, and the offline fallback all passed live.
- Live axe checks found zero serious or critical issues; visible controls had no sub-44 px targets; no horizontal overflow was present.
- Live Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.4 s, CLS 0, TBT 20 ms. INP was not measured in this lab navigation.
- Live security headers include the CSP, microphone policy, frame denial, referrer policy, nosniff, and corrected HSTS. Hashed assets use a one-year immutable cache.

Evidence is under `/work/.evidence/`: `live-cad4040-audit.json`, four `live-cad4040-*.png` screenshots, `lighthouse-live-cad4040.json`, `verify-live-cad4040/`, `clean-checkout-path.txt`, `catalog-description.txt`, and `billing-offer.json`.

## Billing and known dependency

The US$9 one-time Pro deliverable remains implemented. A valid product license removes only the active-pair cap; exports, offline use, recordings, accessibility, and the eight-pair core remain free. Free restores cannot bypass the cap.

The public checkout endpoint still returns the product-registration 404, so the UI accurately says that new checkout is pending. The separate authorised operator can register the exact offer from `/work/.evidence/billing-offer.json`. No credentials are present.

There is no backend, shared database, tenant, health, process restart, or 429 scope for this local-only static PWA. Personal state remains in browser IndexedDB.

## Next step

Register the billing offer. Set `VITE_BILLING_AVAILABLE=true` only after its checkout endpoint exists. No product-code or verification gap remains.
