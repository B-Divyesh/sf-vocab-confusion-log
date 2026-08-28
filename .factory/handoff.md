# Vocab Confusion Log — repair handoff

- Work order: `vocab-confusion-log-repair-2`
- Base / failed candidate: `763199e18b7812cb43bdc0ebf1531c752d107298` / `2c9ab525f577f00dd33629e9b8a5fd670cc4ea74`
- Repair commit: `34e5b50731060aced11ef9836526081dd485c23b`
- Deployment: <https://vocab-confusion-log.sociobot.in>
- Azure Static Web Apps deployment ID: `5efdefa7-66c4-4d3e-95ec-bb4180f567ca`
- Verified: 2026-08-28 UTC
- Status: **release-blocking P2 repaired, deployed, and live-verified.**

## What changed

The independent verifier’s only release blocker was the visible `01` and `02` Data-page panel ordinals. They used the structural rule token (`#A69A83`) on `#FFF9EB`, which is 2.64:1 and failed axe’s serious color-contrast rule.

- Changed `.panel-number` from `--line` to the existing secondary-copy `--muted` token (`#596168`). It renders at **6.00:1** on `--sheet` (`#FFF9EB`), preserving the repair-room risograph hierarchy while exceeding the 3:1 large-text/UI threshold.
- Added an exact Playwright + axe regression for `/#data`. It waits for the Data heading and fails on any serious or critical axe violation. It runs in both the existing desktop Chromium and 390 × 844 mobile projects.
- No researched-brief workflow, stored data schema, PWA behavior, visual direction, billing behavior, or previously passing functionality changed.

## Clean verification

Executed from a clean dependency install with Node 22.23.2:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

- `npm ci`: passed; 59 packages installed; audit found zero vulnerabilities.
- `npm test`: **10/10** passed (seven scheduling/model tests and three static response-policy tests).
- `npm run build`: passed TypeScript (`tsc --noEmit`) and Vite, producing `dist/index.html`. There is no separate lint script; the build performs the declared type check.
- `npm run test:e2e`: **16/16** passed across desktop Chromium and 390 × 844 mobile. The two new passing cases are the empty Desk and Data-page axe checks, each run in both projects. Existing browser coverage still exercises add/practice, own-voice capture, direct legal pages, keyboard skip focus, mobile overflow, and offline reload.
- `npm audit --omit=dev`: zero known vulnerabilities. This is a private static application, not a published package, so no package-consumer check applies.
- Production sizes: app JS 36,705 B (11,940 B gzip), shared JS 950 B (540 B gzip), CSS 21,642 B (5,450 B gzip), hero WebP 107,462 B. All are below the static-PWA budgets.

## Browser, accessibility, privacy, and PWA evidence

- Factory `verify-url.sh` against the live custom domain: HTTP 200, 818 ms load, zero console/page errors, valid title/lang, exactly one h1, a main landmark, no missing image alts, and no unlabeled buttons.
- A live axe scan of `/#data` returned **zero serious/critical violations** at both desktop and 390 px mobile. Its panel ordinals computed to `rgb(89, 97, 104)` on `rgb(255, 249, 235)` (the 6.00:1 repaired pairing). Both layouts had no horizontal overflow or console/page errors.
- Live keyboard smoke: Tab then Enter on “Skip to main content” focuses `#main-content`.
- Live offline smoke: after service-worker activation, `context.setOffline(true)` followed by reload still served the shell and its “Offline — logging, recordings, and practice still work here.” status.
- Update smoke used the actual built app and service-worker source in a two-revision local static fixture. Revision two produced “A fresh version is ready,” had a waiting worker before action, and after “Update now” the waiting worker cleared while an activated worker controlled the reloaded page.
- Ordinary-use live request capture on desktop and mobile contacted only `https://vocab-confusion-log.sociobot.in`; no analytics, trackers, CDNs, or third-party fonts/scripts were requested. Optional license verification remains the documented Sociobot API behavior only after a license exists.
- Live Lighthouse 12.8.2 mobile: **Performance 99, Accessibility 100, Best Practices 100, SEO 100**; LCP 1,653 ms, CLS 0, TBT 119 ms.

## Deployment, policy, and identity evidence

- Deployed with `/opt/fleet/lib/deploy-static.sh vocab-confusion-log /work/repo/dist`; the custom domain returned HTTPS 200 after upload.
- Live `/` is `no-cache, must-revalidate`; `/sw.js` is `no-cache, no-store, must-revalidate`; current fingerprinted JS and CSS are `public, max-age=31536000, immutable`.
- The live policy includes the source-controlled self-only CSP (with the documented Sociobot API only in `connect-src`), `Permissions-Policy: microphone=(self)`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`.
- Every deployable public build file matched the live byte stream by SHA-256 (excluding the host-consumed `staticwebapp.config.json`). Key release files:

| File | SHA-256 |
| --- | --- |
| `index.html` | `5ee3119f174f45c8404c4747f9a842d4bdb6d3d3e588a890cd3a0ea4e53adab2` |
| `assets/app-DawrVttZ.js` | `e10586a8d8a94f1265d67168e996f4ffb785852d7319576273f1476e0f3ad88e` |
| `assets/skip-link-5JSsjZyU.css` | `4a3177380569c1e9271cd0a5008a01b3ad232539ee796d654de1a531872e9258` |
| `assets/skip-link-BsHzyCpP.js` | `909738ecd28b74c6571c016cf1e2b338eea5e7b8f3a4da68254da8cc063e161c` |
| `sw.js` | `1932adfc238d856eea0b1130fc65099a2d3747e582f4e8804ddc40fc8afebe33` |
| `manifest.webmanifest` | `8e711a95e0d7561b57231420de07f6855117fc85bace09f84c4e5ac344362fe1` |
| `privacy/index.html` | `7c63832221061d682e4be427a64950445e5bbce9c8e3ef9fcb982d4968682126` |
| `terms/index.html` | `a5d63eec89b28b89abf6f71abbb8febccdca1f551b488cbb24e3e02c4476a644` |

## Known follow-up

The managed Azure edge still sends `Strict-Transport-Security: max-age=10886400; includeSubDomains; preload`. The `preload` directive requires a one-year minimum and is platform-owned; this repository’s static response configuration cannot override it. This was recorded by the verifier as non-blocking and remains the only follow-up.
