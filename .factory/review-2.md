# Review 2 — FAIL: vocabulary-confusion repair workflow

- Reviewed: 2026-09-06 UTC
- Live URL: <https://vocab-confusion-log.sociobot.in>
- Implementation candidate: `34e5b50731060aced11ef9836526081dd485c23b`
- Documentation/report SHA: `1e243c80ddccb23f799c99773774eab4475cc000`
- Verdict: **FAIL** — 6 findings and 11 untested public claims. This is not eligible for PASS.

## Job, audience, and first action

The job is to record a pair of easily confused words, add a contrast cue and optional own-voice references, then practise alternating text/audio retrieval until three delayed clean attempts resolve it. It is for language learners who repeatedly confuse near-neighbour words or spellings. The required first action is **“Try it with sample data”** so a visitor can see a populated log before entering any personal data.

Fresh desktop (1440 × 1000) and phone (390 × 844) sessions were opened before scrolling. The actual first screen instead starts the empty personal desk and offers **“Log a confusion.”** It contains no sample action.

## Evidence and checks

The live root references `app-DawrVttZ.js`; SHA-256 for the live HTML and JS exactly matched a clean build from the current checkout. The last implementation change is `34e5b507…`; later commits are documentation only. This establishes that the live application corresponds to the reviewed implementation candidate rather than a failed upload wrapper.

From a detached clean checkout at `1e243c80…`, using Node 22.23.2:

```sh
npm ci                         # PASS — 59 packages, 0 vulnerabilities
npm test                       # PASS — 10 tests
npm run build                  # PASS — writes dist/
npm run test:e2e               # PASS — 16 browser tests
npm audit --omit=dev           # PASS — 0 vulnerabilities
```

No additional declared claim command exists: `.factory/claims.json` is absent and there are no `@claim:` test tags. That is a failed contract, not evidence that the ordinary test suite proves the public claims.

Fresh live browser evidence is stored outside the product at `/work/.evidence/live-audit.json`, with first-screen screenshots for desktop and phone. It found:

- no console errors or page errors in normal use;
- zero axe serious/critical violations on the live Desk and Data views in both viewports;
- no horizontal overflow at 390 px;
- visible skip link and reduced-motion transition of `0.01ms`;
- same-origin requests only during ordinary use;
- offline reload works after service-worker activation and shows the offline status;
- invalid equal words are rejected with a clear recoverable message;
- `/privacy/` and `/terms/` are live, titled, and readable.

The main add and first text-to-audio practice route is covered by the declared Playwright suite. Existing tests also cover own-voice storage, a miss/recovery, import recovery, pair-cap boundary, and CSV export in the local implementation. These positives do not replace the missing demo and claims sandbox.

## Findings

### P1 — required one-click demo sandbox is absent

`/demo` returns HTTP 200 but renders the ordinary empty Desk. It has no realistic populated sample, no **“Demo — sample data, nothing is saved”** label, no **Reset demo**, and no **Start for real**. The root first screen also has no **“Try it with sample data”** action. There is no `.factory/demo.md` and no separate `demo:` storage namespace in the implementation.

This blocks the required verification path and risks a visitor modifying their actual local data when they expect a demo. Implement `/demo` or `?demo=1` with seeded vocabulary pairs, a persistent label and reset/start-real controls, and isolated demo storage. Test it from a fresh context.

### P1 — claims contract is missing; 11 public claims are untested

`.factory/claims.json` does not exist, and neither the tests nor package scripts contain `@claim:` tags. The following visitor-facing, testable claims are therefore unlisted and untested by the required demo sandbox: offline reload; local-only recordings; no ordinary-use data transfer; no analytics; text-to-audio/audio-to-text practice; three delayed clean attempts; JSON backup/import; resolved CSV export; install/update PWA behavior; the eight-active-pair free limit; and the US$9 unlimited-pair unlock.

Add one claims entry and exactly one tagged, observable sandbox test for each claim, or remove the claim. The test commands must be runnable after the documented clean setup.

### P2 — first screen and app copy do not meet the plain-words contract

The sole root `<h1>` is **“Vocab Confusion Log”**, the product name, not a ≤9-word job headline. The prominent heading is **“Stop reviewing everything. Repair the mix-up.”**, which is not a direct job statement. The page uses required-to-remove metaphor/mood wording such as **“A repair bench for near-neighbor words,” “Your desk is clear,” “The repair loop,”** and **“Hear it. Produce it. Contrast it.”**

Replace this with a plain job heading, name the intended learner and result in one short sentence, make the sample action primary, and present the three required facts as plain privacy/offline/price lines. Create and maintain `.factory/copy-audit.md` with the required sentence counts and terminology table.

### P2 — the required landing/site skeleton is missing

The root is only the personal app Desk. It has no landing-to-demo route, no “How it works” section structured around the sample, no plain “what it does not do/privacy” section, no product footer build/version and Param Factory attribution, and no persistent app header links for Demo and Privacy. The current footer only offers Privacy and Terms.

Build the required public landing structure while retaining the app as a real route. The application must continue to work locally and offline after moving the personal Desk behind its own URL.

### P2 — unknown routes are not a designed 404 page

`/no-such-route` returns HTTP 200 and renders the normal Desk (`Vocab Confusion Log — repair the words you mix up`), not an intentional 404 with a way back. `staticwebapp.config.json` has no response override and the source has no 404 page. This is a broken required route rather than the allowed deliberate HTTP 404 behavior.

Add a product-styled 404 document/route, a correct Static Web Apps `responseOverrides` 404 rewrite, and include it in route tests and the sitemap/route review as appropriate.

### P3 — required route metadata is incomplete

Root, privacy, and terms have titles and descriptions, but none supplies a canonical link, Open Graph/Twitter card metadata, a product-specific 1200 × 630 social image, or an Apple touch icon. The root sitemap also omits the required demo route.

Add the required self-hosted metadata/assets and list `/demo` once it exists.

### P3 — earlier managed-edge HSTS advisory remains

The prior reports’ cache and contrast findings are repaired: live fingerprinted assets have `Cache-Control: public, max-age=31536000, immutable`, and live axe has zero serious/critical contrast findings. The remaining earlier advisory is still present: the edge sends `Strict-Transport-Security: max-age=10886400; includeSubDomains; preload`. `preload` conventionally requires at least 31,536,000 seconds. Increase the edge max-age or remove `preload`.

## Disposition of earlier verification findings

| Earlier finding | Current disposition | Evidence |
| --- | --- | --- |
| Immutable caching of hashed assets | Repaired | Live app JS: `public, max-age=31536000, immutable` |
| Data-panel ordinal contrast | Repaired | Live axe: zero serious/critical on Desk and Data, desktop and phone |
| HSTS preload/max-age mismatch | Still open (P3) | Live header remains `max-age=10886400; …; preload` |

## Other required checks

There is no backend, tenant, health, 429, installed-artifact, or CLI/library scope for this static local-first PWA. No live license checkout was attempted; it is an external merchant flow and cannot substitute for a local demo claim test. Privacy and legal routes were checked. The service-worker offline reload passed; the update flow was tested in the repository suite’s existing implementation history but is not a valid public claim test until listed in `claims.json`.

## Required next steps

Implement the demo sandbox, claims inventory/tests, plain-language landing and copy audit, real 404 route, and metadata. Repair the edge HSTS directive. Redeploy, then repeat this review from clean browser contexts and clean checkout. Do not claim PASS until every finding is closed and the untested-claim count is zero.
