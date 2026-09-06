# Verify word-pair practice and the sample sandbox — PASS

- Reviewed: 2026-09-06 UTC
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Implementation candidate: `cad4040b15dd493a8b355f3110b8c2b8193af963`
- Documentation/report SHA at review start: `b2cc85c5ddddcb806b7be6c94910c61391407b95`
- Verdict: **PASS — 0 findings and 0 untested public claims.**

## Job, audience, and first action

The job is to save a confusing word pair, add a short contrast cue and optional personal recordings, then practise text-to-audio and audio-to-text until three delayed correct attempts resolve it. It is for language learners who repeatedly mix up similar words or spellings. Before scrolling in fresh 1440 × 1000 desktop and 390 × 844 phone browsers, the site states the job and audience and offers **Try it with sample data**. The action is in the first viewport and opens three populated sample pairs.

## Clean candidate verification

I used a detached clean checkout at `cad4040b15dd493a8b355f3110b8c2b8193af963` with Node 22.23.2.

```sh
npm ci                         # PASS — 59 packages installed; 0 vulnerabilities
npm test                       # PASS — 12/12 unit and policy tests
npm run build                  # PASS — writes dist/
npm run test:e2e               # PASS — 20/20 desktop and mobile tests
npm audit --omit=dev           # PASS — 0 vulnerabilities
```

The build contains 4.91 KB landing JavaScript, 43.49 KB app JavaScript, and 27.22 KB CSS before gzip. The generated hero WebP is 107.46 KB. This is within the static PWA budgets.

Every command declared in `.factory/claims.json` was run separately after the clean setup. Each ran its build hook and one tagged demo-sandbox test successfully.

| Claim ID | Result |
| --- | --- |
| `offline-reload` | PASS |
| `recordings-local` | PASS |
| `ordinary-use-local` | PASS |
| `no-analytics` | PASS |
| `alternating-practice` | PASS |
| `three-delayed-attempts` | PASS |
| `miss-ten-minutes` | PASS |
| `json-backup-restore` | PASS |
| `resolved-csv` | PASS |
| `pwa-install-update` | PASS |
| `free-eight-pairs` | PASS |
| `pro-unlimited` | PASS |

The 12 claim entries each have one tagged, observable test and cover the matching public copy in the landing page, app, README, privacy page, and terms. No unlisted reliance claim was found in that review. The unpaid checkout status is described as pending, not as a working checkout claim.

## Fresh live verification

The live HTML, route documents, service worker, manifest, sitemap, and fingerprinted JavaScript, CSS, and social image SHA-256 values match the fresh `dist/` build. This confirms that the live product is the implementation candidate, not only the later documentation commit.

- Valid root, Demo, Log, six nested app URLs, Privacy, Terms, robots, sitemap, manifest, and service worker returned HTTP 200.
- Unknown top-level, `/log/`, and `/demo/` paths returned deliberate HTTP 404 responses with the titled recovery page and **Return home**. The expected browser network message for that HTTP 404 was not treated as a console defect.
- The demo opened with `affect / effect`, `desert / dessert`, and the resolved `embarazada / embarrassed` sample. Its persistent **Demo — sample data, nothing is saved** label was present.
- Adding `principal / principle` in Demo worked; **Reset demo** restored the original sample and removed it. A separate real `stationary / stationery` record survived Demo exit, while the Demo record did not enter the real log.
- Invalid whitespace input produced the announced, linked error, moved focus to Word A, and set `aria-invalid="true"`.
- Ordinary demo logging and practice made only same-origin requests and created no cookies. A fresh browser context loaded the previously visited Demo offline, displayed the offline status, and retained the sample.
- Keyboard skip-link and route-focus behavior passed in the browser suite. Reduced motion reported a `0.01ms` transition. Phone pages had no horizontal overflow and no visible control smaller than 44 px.
- The factory URL verifier passed: title, `lang=en`, one H1, main landmark, alt text, labelled buttons, and zero normal-load console errors.
- Axe found zero serious or critical violations on root, Demo, Log, Privacy, Terms, and the 404 page in both desktop and phone contexts.
- Every public route has its own title, one H1, canonical, description, Open Graph/Twitter metadata, sharing image, and Apple touch icon. The sitemap lists every valid route.
- Lighthouse 13.4 generated a mobile report with Performance 100, Accessibility 100, Best Practices 100, and SEO 100; LCP 1.48 s, CLS 0, and TBT 91 ms.

Evidence is in `/work/.evidence/verify-url-4/`, `/work/.evidence/verification-4-*.png`, and `/work/.evidence/lighthouse-verify-4.json`.

## Earlier finding disposition

| Earlier finding | Current disposition | Current proof |
| --- | --- | --- |
| Review-2: no isolated one-click demo | Closed | Live `/demo/` is seeded, labelled, resettable, and uses its own `demo:` IndexedDB namespace. Live exit preserved a separately created real record and discarded the Demo record. |
| Review-2: 11 untested claims and no contract | Closed | `.factory/claims.json` has 12 claims; all 12 independently passed against Demo. |
| Review-2: non-job-led first screen and metaphor copy | Closed | Fresh desktop and phone first screens state “Practise the words you mix up,” audience, sample action, and facts before scrolling. |
| Review-2: missing landing structure | Closed | Landing has header, action, populated preview, three steps, scope/privacy, pricing status, and footer. |
| Review-2: unknown routes opened the normal app | Closed | Live invalid top-level and nested paths are HTTP 404 with the designed recovery page. |
| Review-2: incomplete route metadata | Closed | Live titles, canonicals, descriptions, social metadata/image, touch icon, and sitemap are complete across routes. |
| Earlier: immutable cache header | Closed | Live fingerprinted app JavaScript returns `Cache-Control: public, max-age=31536000, immutable`. |
| Earlier: data-panel contrast | Closed | Fresh live axe checks returned zero serious/critical violations on public and app screens. |
| Earlier: HSTS preload mismatch | Closed | Live HSTS is `max-age=31536000; includeSubDomains; preload`. |

## Scope and known external dependency

This is a static, browser-local PWA. There is no backend, shared database, tenant, process restart, health endpoint, rate limit, or 429 path to verify. The Pro license integration remains implemented and its recorded-response claim passes; new checkout remains intentionally unavailable until billing registration is completed. That external registration is not a product defect and is communicated in the UI.
