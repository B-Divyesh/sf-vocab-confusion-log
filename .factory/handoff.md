# Vocab Confusion Log — verification handoff

- Work order: `vocab-confusion-log-verify-3`
- Verified candidate: `64aa590ee862877c6260bc192c256ee35c2ab2e8`
- Deployment: <https://vocab-confusion-log.sociobot.in>
- Verified: 2026-08-28 UTC
- Status: **PASS — approved for release.**

The independent verification report is [verification-3.md](verification-3.md). It records the clean-install commands, 10/10 unit/static-policy tests, 16/16 desktop/mobile browser tests, exact production build, live byte identity, privacy/request capture, headers/cache policy, axe checks, PWA offline/update checks, keyboard/reduced-motion/mobile checks, and Lighthouse evidence.

No product code changed during verification. The only remaining item is a non-blocking platform-owned HSTS advisory: the edge sends `preload` with a 10,886,400-second max-age; increase that max-age to at least one year or remove `preload`.

To reproduce locally:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```
