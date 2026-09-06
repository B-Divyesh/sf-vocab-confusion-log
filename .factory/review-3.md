# Strict review 3 — PASS: log and practise confusing word pairs

- Reviewed: 2026-09-06 UTC
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Implementation candidate: `cad4040b15dd493a8b355f3110b8c2b8193af963`
- Documentation baseline: `a09508088b4366332de112b6ba8a0328811cb1c9`
- Verdict: **PASS — 0 findings and 0 untested public claims.**

## Job, audience, and first action

The job is to save two words a learner mixes up, add a contrast cue and optional personal recordings, then practise spelling and audio recall until three delayed correct attempts resolve the pair. It is for language learners who repeatedly confuse similar words or spellings. Before scrolling, fresh 1440 × 1000 desktop and 390 × 844 phone sessions both showed **Practise the words you mix up**, the learner sentence, and **Try it with sample data**. The action opens a populated sample rather than a personal log.

## Clean candidate result

I cloned the candidate into a new temporary checkout at `cad4040…` using Node `v22.23.2`, then ran:

```sh
npm ci                         # PASS — 59 packages; 0 install vulnerabilities
npm test                       # PASS — 12/12 unit and deployment-policy tests
npm run build                  # PASS — writes dist/
npm run test:e2e               # PASS — 20/20 desktop and phone tests
npm audit --omit=dev           # PASS — 0 vulnerabilities
```

The production build has 4.91 KB and 43.49 KB JavaScript entry chunks, 27.22 KB CSS, and a 107.46 KB hero WebP before gzip. This is within the static PWA budgets.

I ran every declared command in `.factory/claims.json` separately after the clean setup. Each command rebuilt the project and ran its one tagged, observable Demo test successfully:

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

All 12 public reliance claims have an entry and exactly one `@claim:` test. No unlisted reliance claim was found in the landing page, app, README, privacy page, or terms.

## Fresh live result

The live root, Demo, six nested Demo/Log views, Privacy, Terms, manifest, service worker, robots, sitemap, and sharing assets were checked in new browser contexts. Live root, route documents, service worker, manifest, sitemap, three fingerprinted assets, and social image SHA-256 values match the clean candidate `dist/` files. The live site therefore represents `cad4040…`; `a095080…` is report-only documentation.

- Root, Demo, Log, all six nested app routes, Privacy, Terms, manifest, sitemap, robots, and service worker returned 200. Unknown top-level, `/log/`, and `/demo/` paths returned intentional 404 pages headed **This page does not exist** with **Return home**.
- Demo contained `affect / effect`, `desert / dessert`, and a resolved `embarazada / embarrassed` pair. Its persistent **Demo — sample data, nothing is saved** label, **Reset demo**, and **Start for real** controls were present. Adding `principal / principle`, resetting, and then exiting showed reset removes the addition. A separately saved real `stationary / stationery` pair survived Demo exit; the Demo addition did not enter the real log.
- Whitespace-only input produced the announced required-field message, set `aria-invalid="true"`, and moved focus to Word A. The declared regression suite additionally covers equal/reversed pairs, import recovery, deletion cancellation, native-dialog focus, free-tier boundaries, recording, and practice recovery.
- The visited Demo service worker served the populated Demo offline after reload and showed the offline notice. Claim testing separately confirms the uncached offline fallback, service-worker update path, local recording storage, no cookies/beacons, and same-origin ordinary use.
- Desktop and phone pages had no normal-load console or page errors. Phone scroll width equalled client width, all visible interactive controls were at least 44 px, and reduced motion reported `0.01ms`/`1e-05s` transitions. The keyboard route/skip-link and focus checks passed in the fresh 20-test browser suite.
- `verify-url.sh` passed on the live root: title present, `lang="en"`, one H1, main landmark, zero images without alt, zero unlabelled buttons, and no console errors. Fresh axe scans found zero serious or critical violations on root, Demo, Log, Privacy, Terms, and 404. The product is deliberately single-mode, as recorded in the visual thesis.
- Each valid route had its own title, one H1, main landmark, canonical, description, Open Graph/Twitter metadata and product sharing image. Live headers include the CSP, `nosniff`, frame denial, strict referrer policy, microphone policy, preload-compatible one-year HSTS, and immutable caching for fingerprinted assets.

Lighthouse could not be rerun in this container because its launcher crashed the supplied Chromium tab. This is a verifier-environment limitation, not an untested public claim. The immediately preceding independent live report records 100/100/100/100 mobile category scores; this review reproduced the functional, accessibility, responsive, and load-error checks directly.

## Earlier finding disposition

| Earlier finding | Current disposition | Current evidence |
| --- | --- | --- |
| Review-2: no isolated one-click Demo | Closed | Live Demo is seeded, labelled, resettable, and its additions are discarded on exit while real data survives. |
| Review-2: missing claims contract and 11 untested claims | Closed | 12 declared Demo claim commands each passed independently from clean setup. |
| Review-2: first screen was not job-led/plain words | Closed | Fresh desktop and phone first screens state the job, audience, facts, and Demo action. |
| Review-2: missing landing/site skeleton | Closed | Live landing has header, preview, steps, scope/privacy, price status, legal links, and Param Factory/version footer. |
| Review-2: unknown routes opened the app | Closed | Fresh top-level and nested invalid paths return deliberate designed HTTP 404 responses. |
| Review-2: incomplete metadata | Closed | Valid routes have route-specific title/canonical/description/social metadata and sitemap entries. |
| Earlier immutable-cache advisory | Closed | Live fingerprinted assets return one-year immutable cache headers. |
| Earlier data-panel contrast advisory | Closed | Fresh axe checks returned zero serious/critical violations. |
| Earlier HSTS preload mismatch | Closed | Live HSTS is `max-age=31536000; includeSubDomains; preload`. |

## Scope

This is a static, local-first PWA. There is no backend, shared database, tenant, process restart, health endpoint, or 429 path. Browser IndexedDB owns product state. The US$9 Pro license claim is verified with its recorded-response sandbox; new checkout remains accurately marked as pending external billing registration and is not a product QA defect.

Evidence: `/work/.evidence/review-3-live-*.png`, `/work/.evidence/review-3-verify-url/`, and the clean-checkout command output in this review run.
