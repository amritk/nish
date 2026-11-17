---
name: og-video — an og:video share card from the hero animation
overview: The static share card docs/site/og.png shows the landing page's hero at rest. Add docs/site/og.mp4, one 12-second loop of the same hero animating at 1200×630 (the code panel typing, the beams and the three targets lighting, the terminal run, the NISH name unfolding), recorded with Playwright by a committed script and encoded with ffmpeg to H.264 yuv420p with +faststart and no audio, at about 1 MB or less. scalar.config.json gains the og:video tags with og:image kept as fallback and poster; docs/README.md says how to regenerate it and why it is shaped this way.
stages:
  - id: og-video
    title: "docs: add an og:video share card recorded from the hero animation"
    goal: docs/site/og.mp4 (1200×630, H.264, yuv420p, faststart, no audio, one full hero loop, ≤ 1 MiB) is committed with the script that regenerates it, scalar.config.json advertises it with og:video, og:video:secure_url, og:video:type, og:video:width and og:video:height while og:image stays og.png, tests/break-web/check.mjs holds its size budget without needing ffmpeg, and docs/README.md documents it.
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/run.js break-web
    todos:
      - id: recorder
        content: Add the recorder — extend scripts/gen-og-image.mjs or add scripts/gen-og-video.mjs sharing its card page (CARD_CSS, PAGE, the docs/site route) rather than copying it. Record one full cycle of the hero (--nish-cycle in theme.css, 12 s) at 1200×630, deviceScaleFactor 1, dark, reduced motion off, with the NISH name unfolding (it opens on :focus, so focus it at a chosen point in the loop and say why there). Prefer deterministic frames — pause every CSS animation (document.getAnimations()) and seek currentTime per frame, screenshotting each — over recordVideo's wall-clock capture, so the loop's first and last frames meet and a slow machine drops no frames — see og-video
        status: pending
      - id: encode
        content: Encode with ffmpeg to MP4 — libx264, -pix_fmt yuv420p, -movflags +faststart, -an, a frame rate and CRF/preset chosen to land at about 1 MB or less (record the figures in the script head). The script exits non-zero with a clear message when ffmpeg or Playwright is missing; nothing in the build, npm scripts or tests invokes it — see og-video
        status: pending
      - id: commit-video
        content: Generate and commit docs/site/og.mp4; confirm with ffprobe (codec h264, pix_fmt yuv420p, 1200×630, no audio stream, duration ≈ one cycle) and that moov precedes mdat. Install fonts-inter and fonts-jetbrains-mono first so it renders in the hero's own fonts. Leave og.png as it is unless its look changed — see og-video
        status: pending
      - id: meta
        content: In scalar.config.json → siteConfig.head.meta, beside the og:image tags, add og:video and og:video:secure_url (both https://nishlang.com/og.mp4), og:video:type video/mp4, og:video:width 1200, og:video:height 630. Keep og:image, its type/size/alt and twitter:image on og.png — see og-video
        status: pending
      - id: budget
        content: In tests/break-web/check.mjs, beside the site.js and theme.css budgets, check that docs/site/og.mp4 exists, is at most 1 MiB, and starts with an ftyp box and has moov before mdat (read from the bytes — no ffmpeg), and that every og:video URL in scalar.config.json names a file in docs/site. Update knip.json only if the new script needs it — see og-video
        status: pending
      - id: readme
        content: In docs/README.md, extend the og.png bullet (around line 221) and the og:*/twitter:* bullet — what og.mp4 is, the command that regenerates it, that it needs ffmpeg with libx264 besides Playwright and the fonts, that nothing else depends on ffmpeg, and why it is MP4/H.264/yuv420p/faststart/silent and ~1 MB (WebM does not play everywhere; it is committed; unfurlers fetch the head first) and why og.png stays as fallback and poster — see og-video
        status: pending
---

# og-video — an og:video share card from the hero animation

## og-video

**Owns:** `scripts/gen-og-image.mjs`, `scripts/gen-og-video.mjs` (new),
`docs/site/og.mp4` (new), `docs/site/og.png`, `scalar.config.json`,
`docs/README.md`, `tests/break-web/check.mjs`, `knip.json`,
`.claude/plans/og-video.plan.md`.

One PR. No file under `src/`, `std/`, `runtime/` or `tests/` other than
`tests/break-web/check.mjs` changes, so the goldens, nish-cmp and the
reference generator are not moved.

Facts at the base: the card page is built in `scripts/gen-og-image.mjs`
(`CARD_CSS`, `PAGE`, a `page.route` serving `docs/site`). The hero's loop is
CSS-only, driven by `--nish-cycle: 12s` in `docs/site/theme.css`; the NISH
name opens on `:hover`/`:focus` with transitions of 0.6 s staggered 0.08 s per
word. `site.js` already re-seats animations through `getAnimations()` and
`currentTime`, which is the same lever a frame-exact recorder uses. Playwright
is not a package dependency (knip ignores it); ffmpeg with libx264 is present
in the cloud container. The PR body shows one or two frames of the video
(extracted with ffmpeg, embedded or attached) and states the file's size in
bytes.

Out of scope: twitter:player (X plays no og:video), changing og:type, any
change to the hero itself.
