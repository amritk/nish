#!/usr/bin/env node
/*
  Renders docs/site/og.png, the 1200×630 card a link to nishlang.com unfurls
  into (Open Graph, X, Slack, WhatsApp): the landing page's own hero, drawn by
  docs/site/site.js and styled by docs/site/theme.css, with its buttons taken
  out and the site's address put in. Re-run it after a change to the hero.

    node scripts/gen-og-image.mjs [out.png]

  It needs a Playwright with Chromium, which is not a dependency of the
  package: install one where node resolves it (`npm i --no-save playwright`
  and `npx playwright install chromium`) or point NODE_PATH at one. The hero's
  fonts are Inter and JetBrains Mono; with them missing the card renders in a
  fallback, so install both before regenerating (fonts-inter,
  fonts-jetbrains-mono on Debian and Ubuntu).

  scripts/gen-og-video.mjs records the same card in motion; both open it
  through openCard below.
*/
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
/** The site's static files, which the card page is served from. */
export const SITE = join(ROOT, "docs/site")
/** The card's size in CSS pixels, which is its size in pixels at deviceScaleFactor 1. */
export const WIDTH = 1200
export const HEIGHT = 630

/** The card's own rules, over theme.css: the hero fills the frame, and its controls, which do nothing in a picture, leave. */
const CARD_CSS = `
:root { --scalar-font: "Inter", system-ui, sans-serif; --scalar-font-code: "JetBrains Mono", "DejaVu Sans Mono", monospace; }
html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: var(--scalar-background-1); font-family: var(--scalar-font); }
.page-node { width: ${WIDTH}px; height: ${HEIGHT}px; max-width: none !important; margin: 0 !important; }
.nish-hero { margin: 0 !important; }
.nish-hero__inner { box-sizing: border-box; width: ${WIDTH}px; height: ${HEIGHT}px; display: flex; flex-direction: column; justify-content: center; padding: 0 36px 24px; border: 0; border-radius: 0; }
.nish-hero__name { margin-bottom: 14px; font-size: 15px; }
.nish-hero__title { font-size: 58px; }
.nish-hero__actions, .nish-hero__ready, .nish-hero__input { display: none !important; }
.nish-hero__stage { margin-top: 34px; }
.nish-hero__code { padding: 14px 18px; font-size: 15px; line-height: 1.65; font-variant-ligatures: none; }
.nish-hero__bar { padding: 10px 14px; font-size: 13px; }
.nish-hero__target { font-size: 14px; }
.nish-card__site { position: absolute; right: 36px; bottom: 22px; font: 500 17px var(--scalar-font-code); letter-spacing: 0.02em; color: var(--scalar-color-2); }
`

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="/theme.css">
<style>${CARD_CSS}</style>
</head><body class="dark-mode scalar-app"><div class="page-node"><div data-nish-hero></div></div>
<script src="/site.js"></script></body></html>`

const TYPES = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" }

/**
 * Opens the card in a fresh Chromium: the hero built and ready, its fonts and
 * images loaded, the site's address put in. Exits with status 2 when no
 * Playwright resolves.
 * @param {string} tool The calling script's name, for the error message.
 * @param {"reduce" | "no-preference"} reducedMotion "reduce" is the hero at rest; "no-preference" is it running.
 * @returns {Promise<{ browser: import("playwright").Browser, page: import("playwright").Page }>} The browser, for the caller to close, and the card's page.
 */
export const openCard = async (tool, reducedMotion) => {
  const require = createRequire(import.meta.url)
  let chromium
  try {
    ;({ chromium } = require("playwright"))
  } catch {
    console.error(`${tool}: no Playwright found; see the header of scripts/gen-og-image.mjs`)
    process.exit(2)
  }
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion,
    })
    // The page asks for the site's root paths; they are answered from docs/site.
    await page.route("http://card.local/**", (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === "/") {
        return route.fulfill({ contentType: "text/html", body: PAGE })
      }
      const file = join(SITE, path)
      const ext = path.slice(path.lastIndexOf("."))
      if (!file.startsWith(`${SITE}/`) || !(ext in TYPES)) {
        return route.fulfill({ status: 404 })
      }
      return route.fulfill({ contentType: TYPES[ext], body: readFileSync(file) })
    })
    await page.goto("http://card.local/")
    await page.waitForSelector("[data-nish-hero][data-nish-ready]")
    await page.evaluate(() => {
      const site = document.createElement("span")
      site.className = "nish-card__site"
      site.textContent = "nishlang.com"
      document.querySelector(".nish-hero__inner").append(site)
    })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() =>
      [...document.images].every((image) => image.complete && image.naturalWidth > 0)
    )
    return { browser, page }
  } catch (error) {
    await browser.close()
    throw error
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = resolve(process.argv[2] ?? join(SITE, "og.png"))
  // Reduced motion is the hero at rest: every line typed, every target lit.
  const { browser, page } = await openCard("gen-og-image", "reduce")
  try {
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } })
    console.log(`gen-og-image: wrote ${out}`)
  } finally {
    await browser.close()
  }
}
