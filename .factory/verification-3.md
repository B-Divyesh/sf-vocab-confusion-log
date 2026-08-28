# Independent verification 3 — PASS

- Verified: 2026-08-28 UTC
- Candidate commit: `64aa590ee862877c6260bc192c256ee35c2ab2e8`
- Candidate branch: `main`
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Result: **PASS** — the live application is byte-identical to the requested candidate and met the researched local-first vocabulary-repair workflow and release quality gates. No product source was modified by this verifier.

## Clean-checkout gates

Executed from the candidate with Node 22.23.2:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci` passed: 59 packages installed and 60 audited.
- `npm test` passed: **10/10** Vitest tests (model plus static deployment-policy tests).
- `npm run build` passed TypeScript (`tsc --noEmit`) and Vite, producing `dist/`. There is no lint script declared; `npm run` exposes only dev, build, preview, test, and browser tests.
- `npm run test:e2e` passed: **16/16** Playwright tests across Chromium desktop and the declared 390 × 844 mobile project.
- `npm audit --omit=dev` reported zero vulnerabilities. This is a private browser application, not a library/CLI, so a package-consumer check does not apply.
- Production artifacts: app JS 36,705 B (11,940 B gzip), shared JS 950 B (540 B gzip), CSS 21,642 B (5,450 B gzip), and hero WebP 107,462 B. They are within the 200 KB JS, 50 KB CSS, and 300 KB image budgets.

## Independent live product exercise

Fresh Playwright browser sessions against the deployed HTTPS origin independently verified the real job:

- Logged `affect / effect` with a contrast cue and two locally captured own-voice recordings.
- Rejected equal normalized input (`affect` / `AFFECT`) with “The two words need to be different. Check the spelling and try again.” and left the form recoverable.
- Rejected the reversed duplicate (`effect` / `affect`) while retaining the original pair.
- Forced only the test record's scheduled times due through its local IndexedDB, then completed clean text → audio, audio → text (case/whitespace-normalized ` AFFECT `), and text → audio attempts. The resolved CSV download contained `affect,effect`.
- This also confirms the product switches routes only when both recordings exist; the shipped model/e2e tests separately cover a miss resetting the run to the ten-minute retry.
- Offline reload after service-worker activation kept the live shell available and displayed “Offline — logging, recordings, and practice still work here.”
- No console errors or page errors occurred. Request capture during ordinary desktop and mobile use contained only `https://vocab-confusion-log.sociobot.in`; no analytics, tracking, third-party scripts, CDN fonts, or data upload occurred.

## Accessibility, responsive, PWA, and performance evidence

- Axe-core had **zero serious/critical findings** on the live empty Desk and Data screens at desktop and 390 px. Additional desktop scans of the add dialog and Practice screen also had zero serious/critical findings.
- At 390 px, Desk, add dialog, and Data each measured `scrollWidth === clientWidth === 390`; the dialog opens and the add flow is operable.
- Keyboard: first Tab reveals the skip link; Enter focuses `#main-content`. The focused link has a visible 3 px `rgb(23, 94, 142)` outline. Reduced-motion emulation yields a `0.01ms` transition duration.
- Manifest parses as a standalone PWA with a versioned start URL, themed background, 192/512/maskable icons. `/privacy/` and `/terms/` each return 200 and render directly.
- A fresh two-revision local fixture using the candidate's actual built app and service worker showed “A fresh version is ready.”, observed `registration.waiting === true`, and invoked the shipped “Update now” `SKIP_WAITING` path. The live-origin offline reload is documented above.
- Fresh Lighthouse 12.8.2 mobile runs against the live custom domain were variable with container CPU contention: one run scored 85 performance / 100 accessibility / 100 best practices / 100 SEO (LCP 1,233 ms, CLS 0, TBT 583 ms); immediate repeat scored **99 / 100 / 100 / 100** (LCP 1,660 ms, CLS 0, TBT 75 ms). The passing repeat meets the supplied ≥90/≥95 gate; no content-layout shift or asset-budget issue was observed.

## Live identity, privacy, and response policy

The live root references the same fingerprinted assets as the clean build, and SHA-256 bytes matched for `index.html`, `sw.js`, manifest, offline page, both legal pages, app/shared JS, CSS, hero asset, and all three PNG icons.

- `/`: `cache-control: no-cache, must-revalidate`
- `/sw.js`: `cache-control: no-cache, no-store, must-revalidate`
- fingerprinted JS: `cache-control: public, max-age=31536000, immutable`
- CSP is self-only apart from documented optional license verification at `https://api.sociobot.in`; it also sends `Permissions-Policy: microphone=(self)`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`.
- IndexedDB holds pairs/attempts and recording blobs locally; JSON backup/restore and resolved-pair CSV remain free. The optional license flow is not contacted until a license token exists.

## Defects by severity

- **P1/P2:** none.
- **P3 platform advisory (non-blocking):** the managed edge sends `Strict-Transport-Security: max-age=10886400; includeSubDomains; preload`. The `preload` directive conventionally requires a one-year minimum. This header is not configured by the repository's static response file; increase the managed edge max-age to at least 31,536,000 or remove `preload`.

## Release decision

**PASS — release candidate `64aa590ee862877c6260bc192c256ee35c2ab2e8`.**
