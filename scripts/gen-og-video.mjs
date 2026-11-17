#!/usr/bin/env node
/*
  Renders docs/site/og.mp4, the og:video beside og.png: the same 1200×630
  card (scripts/gen-og-image.mjs builds it) with the hero running one whole
  cycle — the code typed, the beams and the three targets lit, the terminal
  run — and the NISH name unfolding into its words and folding back. Re-run
  it after a change to the hero, with og.png.

    node scripts/gen-og-video.mjs [out.mp4]

  It needs what gen-og-image.mjs needs (Playwright with Chromium, the Inter
  and JetBrains Mono fonts) and ffmpeg with libx264 on PATH. Nothing in the
  build, the npm scripts or the tests runs it, so nothing else needs ffmpeg.

  The frames are exact, not a screen recording: every animation and
  transition on the page is paused and seeked to each frame's time before
  that frame is shot, so a slow machine drops no frame and the clip is one
  cycle to the frame. The page's entrance (nish-rise) is held finished, so
  the first frame is the panel, not a blank card. The ambient motions
  (aurora, sheen, spinner) run on their own periods, which 12 s does not
  divide, so they step at the loop point; the cycle itself steps there too,
  from the finished run back to an empty file, as the hero would on a reload.

  Encoding, measured on this card: 30 fps, libx264 -preset veryslow -crf 20,
  yuv420p, +faststart, no audio track: 360 frames, 12.0 s, about 490 KB
  (-crf 23 gave 358 KB, -crf 30 174 KB). The
  1 MiB budget tests/break-web/check.mjs holds leaves room for a busier hero.
*/
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { HEIGHT, SITE, WIDTH, openCard } from "./gen-og-image.mjs"

const OUT = resolve(process.argv[2] ?? join(SITE, "og.mp4"))
/** One cycle of the hero: --nish-cycle in docs/site/theme.css. */
const CYCLE_MS = 12_000
const FPS = 30
const CRF = 20
/*
  The name opens on :focus. The run is over by 7 s (the terminal's output
  lands at 58% of the cycle), and the rest of the cycle holds still; the name
  opens there, so it competes with nothing, and folds back from 10.5 s, done
  by 11.4 s (0.6 s plus 0.08 s a word), so the last frame's name is the first
  frame's.
*/
const FOCUS_MS = 7_500
const BLUR_MS = 10_500

const ffmpeg = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" })
if (ffmpeg.error || ffmpeg.status !== 0) {
  console.error(
    "gen-og-video: no ffmpeg on PATH; install one with libx264 (see the header of scripts/gen-og-video.mjs)"
  )
  process.exit(2)
}
if (!/\blibx264\b/.test(ffmpeg.stdout)) {
  console.error("gen-og-video: this ffmpeg has no libx264 encoder; install one that does")
  process.exit(2)
}

const frames = mkdtempSync(join(tmpdir(), "og-video-"))
const { browser, page } = await openCard("gen-og-video", "no-preference")
try {
  await page.evaluate(() => {
    // Each animation's time zero: 0 for those already running, the frame it
    // appeared on for a transition that focus or blur starts later.
    const origins = new Map()
    window.seekCard = (ms) => {
      for (const animation of document.getAnimations()) {
        if (!origins.has(animation)) {
          origins.set(animation, ms)
          animation.pause()
        }
        const rise = animation.animationName === "nish-rise"
        animation.currentTime = rise
          ? animation.effect.getComputedTiming().endTime
          : ms - origins.get(animation)
      }
    }
  })
  const name = page.locator(".nish-hero__name")
  const count = (CYCLE_MS / 1000) * FPS
  let focused = false
  for (let frame = 0; frame < count; frame++) {
    const ms = (frame * 1000) / FPS
    const open = ms >= FOCUS_MS && ms < BLUR_MS
    if (open !== focused) {
      focused = open
      await name.evaluate((node, on) => (on ? node.focus({ focusVisible: false }) : node.blur()), open)
    }
    await page.evaluate((at) => window.seekCard(at), ms)
    await page.screenshot({
      path: join(frames, `${String(frame).padStart(4, "0")}.png`),
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    })
  }
} finally {
  await browser.close()
}

try {
  const encode = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      String(FPS),
      "-i",
      join(frames, "%04d.png"),
      "-c:v",
      "libx264",
      "-preset",
      "veryslow",
      "-crf",
      String(CRF),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      OUT,
    ],
    { stdio: "inherit" }
  )
  if (encode.status !== 0) {
    console.error(`gen-og-video: ffmpeg failed (status ${encode.status})`)
    process.exit(1)
  }
  console.log(`gen-og-video: wrote ${OUT}`)
} finally {
  rmSync(frames, { recursive: true, force: true })
}
