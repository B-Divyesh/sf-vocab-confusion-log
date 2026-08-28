# Independent verification 2 — FAIL

- Verified: 2026-08-28 UTC
- Candidate commit: `2c9ab525f577f00dd33629e9b8a5fd670cc4ea74`
- Candidate branch: `main`
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Result: **FAIL** — one release-blocking P2 accessibility defect remains. The deployed site is byte-identical to the candidate and the previously reported immutable-cache issue is repaired, but axe reports a serious color-contrast violation on the Data page at both desktop and 390 px mobile. The factory acceptance contract requires zero serious/critical axe findings.

No product source was changed during this verification.

## Clean checkout quality gates

Executed from the requested clean candidate using Node 22.23.2:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci`: passed; 59 packages installed and 60 audited.
- `npm test`: passed, 2 files / 10 tests. This includes the model tests and static deployment-policy tests.
- No standalone lint script is declared. `npm run build` runs `tsc --noEmit` and Vite; it passed and produced `dist/`.
- `npm run test:e2e`: passed, 14/14 across desktop Chromium and a 390 × 844 mobile project. The test runner records `test-results/.last-run.json` status `passed`.
- `npm audit --omit=dev`: zero known vulnerabilities.
- Build sizes: main JS 36,705 B (11,940 B gzip); shared skip-link JS 950 B (540 B gzip); CSS 21,641 B (5,460 B gzip); hero WebP 107,462 B. The initial JS is far below 200 KB, CSS below 50 KB, and the hero image below 300 KB.
- Fresh mobile Lighthouse (live URL, Chromium 1208): Performance **94**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP 1.6 s, CLS 0, TBT 280 ms. Lighthouse starts on the Desk and therefore does not visit the failing Data view described below.

## Independent product exercise

In addition to the repository suite, fresh production-preview browser checks exercised the researched job-to-be-done and recovery paths:

- Logged `affect / effect` with a contrast cue and mnemonic; persisted it through reload.
- Rejected normalized equal input (`affect` / `AFFECT`) with the inline recovery message: “The two words need to be different. Check the spelling and try again.”
- Rejected the reversed duplicate (`effect` / `affect`) while keeping the valid record.
- Accepted two own-voice recordings for `ship / sheep`; completed text → audio, then audio → text with case/whitespace-normalized input ` SHIP `, then text → audio again. After forced scheduled due times in test storage, the third clean attempt resolved the pair and CSV export contained `ship,sheep`.
- Confirmed a miss/retry is covered by the shipped test suite; the product model requires a ten-minute return. The three-clean scheduling model tests also pass.
- Added eight active pairs through the actual UI. The ninth action routes to Data and shows “The free desk holds 8 active pairs. Resolve one or unlock unlimited pairs.” Resolved pairs are not included in the cap by the model/UI logic.
- Selected an unsupported JSON backup, accepted the explicit import confirmation, and received the recoverable message “This is not a supported Vocab Confusion Log backup.”
- Dismissed the exact delete confirmation for `word1 / term1`; the pair remained, proving no accidental destructive action on cancel.
- No console errors or page errors were observed in these exercises.

## PWA, privacy, responsive, and keyboard checks

- Local production preview and the live URL both activated their service worker, cached the app JS, CSS, and offline document, then successfully reloaded while `context.setOffline(true)`. The cached shell showed “Offline — logging, recordings, and practice still work here.” No console/page errors occurred.
- A separate two-revision fixture running the candidate’s actual built service worker verified the update path: update toast appeared, `waiting` was true before action, “Update now” activated the replacement worker, reloaded the client, cleared `waiting`, and left an activated controlling worker.
- Desktop and 390 × 844 mobile both had no horizontal overflow. The mobile add flow is operable. Reduced-motion emulation reduces button transition duration to `0.01ms`.
- Keyboard check on a fresh Desk page: first Tab reveals “Skip to main content”; Enter moves focus to `#main-content`. The designed blue focus outline is present. Legal-page skip links also focus their main landmark.
- Ordinary-use request capture on live desktop and mobile contained only `https://vocab-confusion-log.sociobot.in`; no analytics, tracking, third-party font, or runtime CDN request was seen. Source and policy inspection confirm the sole configured external connection is `https://api.sociobot.in`, used for an optional license verification after a license token exists.
- Manifest parsed without Chrome errors and includes standalone display, themed colors, start URL/version query, and 192/512/maskable icons. Direct `/privacy/` and `/terms/` return and render correctly.

## Live deployment identity and response policy

The live root references exactly the candidate asset names and their bytes match the clean production build.

| File | SHA-256 |
| --- | --- |
| `index.html` | `a7aed30d033ac568bb60c76b5a31cd87e7445849afe9ba8141a68bdfb4c81eb4` |
| `assets/app-BTFRWLIb.js` | `c0e223c9267fbad97247bcc01749584af1ecba4e0d0b908e7f14e00a9e8047a8` |
| `assets/skip-link-DIHsS9UE.js` | `7e8a99e197591d7c632757977b12f67ae5457446721270d72c40ae00f06fb0c5` |
| `assets/skip-link-DAzFukb-.css` | `798e7c9cb261b8f8911e0313324c6a51fd50e05c8326e9afa75964c8eafca07e` |
| `sw.js` | `e7e6e51cadd79b599a72f293e0a633cd67eaa68726a501df411a10de4aa8c1f1` |
| `manifest.webmanifest` | `8e711a95e0d7561b57231420de07f6855117fc85bace09f84c4e5ac344362fe1` |
| `offline.html` | `79293e275067d01a47bd8dbcdc12047d04a291d0dc4178f5a209803f997295c9` |
| `privacy/index.html` | `23d1868429214c6cd41f465366b754d2daf2607f5f2cc30e093ade989515a8ef` |
| `terms/index.html` | `3e81547984ffb64cd71f217b5c59c383648a71488681bcdc90803517a97fe8fa` |

Fresh live headers show the earlier deployment-only issue is fixed:

- Fingerprinted `/assets/*`: `cache-control: public, max-age=31536000, immutable`.
- `/`: `cache-control: no-cache, must-revalidate`.
- `/sw.js`: `cache-control: no-cache, no-store, must-revalidate`.
- CSP restricts sources to self plus the documented Sociobot API; `Permissions-Policy: microphone=(self)`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff` are present.
- HSTS remains platform-managed at `max-age=10886400; includeSubDomains; preload`. This is a non-blocking platform follow-up: that duration is shorter than the HSTS preload-list requirement.

## Defects

### P2 — release blocking: serious text contrast failure on the Data page

On both the live site and local production preview, axe-core reports `color-contrast` with **serious** impact for these visible elements:

```text
section[aria-labelledby="export-title"] > .panel-number   ("01")
section[aria-labelledby="import-title"] > .panel-number   ("02")
```

The failure is reproducible at desktop and 390 px mobile. axe measures `#A69A83` on `#FFF9EB` at a **2.64:1** ratio for 32 px normal-weight text; the required large-text/UI minimum is 3:1. The source is `.panel-number { color: var(--line) }`. Use a token/color meeting at least 3:1 on `--sheet`, or mark these ordinal decorations `aria-hidden="true"` *and* adjust their visible contrast; semantic hiding alone does not meet the visual contrast requirement.

This does not prevent core use, so it is P2 rather than P1, but it is release-blocking under the supplied accessibility contract: “fix all serious/critical issues before handoff.”

### P3 — platform follow-up: invalid HSTS preload combination

The live edge sends `Strict-Transport-Security: max-age=10886400; includeSubDomains; preload`. A preload directive requires at least one year; the managed edge should either increase `max-age` to at least 31,536,000 seconds or remove `preload`. This is not caused by candidate application bytes and does not change the FAIL result.

## Release decision and next step

**Do not release this candidate.** Change the Data-page ordinal color/contrast, add an axe regression that visits `#data` (the existing axe test only checks the empty Desk), run the gates above, redeploy, and repeat live axe checks. No source-code correction was made by this verifier.
