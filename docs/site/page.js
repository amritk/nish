/*
  What every docs page gets besides the hero (which is site.js): the pages'
  structured data (JSON-LD) for search and answer engines, the browser's
  theme-color, and a path in a table that may break at its slashes. It draws
  nothing; with this file missing the pages read the same.
*/
;(() => {
  if (window.__nishPage) {
    return
  }
  window.__nishPage = true

  const SITE = "https://nishlang.com"
  const DESCRIPTION =
    "Nish compiles TypeScript ahead of time to fast native binaries for x86_64, ARM64 and WebAssembly. No interpreter, no JIT, no garbage collector: just one small executable."

  /** What Nish is, the same on every page. Nothing here names a person. */
  const PROJECT = [
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "Nish", inLanguage: "en" },
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Nish",
      url: `${SITE}/`,
      logo: `${SITE}/icon-512.png`,
      sameAs: ["https://github.com/amritk/nish"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#software`,
      name: "Nish",
      alternateName: "Native Instruction Static Host",
      description: DESCRIPTION,
      url: `${SITE}/`,
      image: `${SITE}/icon-512.png`,
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "Compiler",
      operatingSystem: "Linux, macOS",
      license: "https://github.com/amritk/nish/blob/main/LICENSE",
      sameAs: ["https://github.com/amritk/nish", "https://www.npmjs.com/package/nish"],
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ]

  /**
   * Structured data (schema.org JSON-LD): what Nish is on every page and, on
   * any other page than the home page, what that page is, read from the
   * og:title (its route's, from scripts/route-head.mjs) or the title, and the
   * description Scalar has put in the head. Scalar renders none of its own:
   * its head config loads a script only by path or URL, and a crawler reads
   * no JSON-LD from a script's src, so the block cannot be in the server HTML
   * from the config and is written here. The site is a single-page app, so
   * the block is rewritten whenever the route or the head changes, and only
   * when its text would differ, so its own write does not start another.
   */
  const structuredData = () => {
    const path = location.pathname.replace(/\/+$/, "") || "/"
    const graph = [...PROJECT]
    if (path !== "/") {
      const description = document.querySelector('meta[name="description"]')?.getAttribute("content")
      graph.push({
        "@type": "TechArticle",
        "@id": `${SITE}${path}#article`,
        url: `${SITE}${path}`,
        headline:
          document.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
          document.title.replace(/\s+[|·–—-]\s+Nish$/, ""),
        ...(description ? { description } : {}),
        inLanguage: "en",
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${SITE}/#software` },
      })
    }
    const text = JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    let block = document.getElementById("nish-structured-data")
    if (!block) {
      block = document.createElement("script")
      block.id = "nish-structured-data"
      block.type = "application/ld+json"
      document.head.append(block)
    }
    if (block.textContent !== text) {
      block.textContent = text
    }
  }

  /**
   * A path in a table cell, such as `nish/net/http1-client-codec`, may break
   * after a slash and nowhere else: theme.css keeps a name in a table whole,
   * and a long path would otherwise widen its column past the page. Only code
   * with no markup inside is touched, so each is rewritten once; should
   * Scalar redraw one, the next pass puts its breaks back.
   */
  const pathBreaks = () => {
    for (const code of document.querySelectorAll("table.t-editor__table code")) {
      if (code.childElementCount > 0 || !code.textContent.includes("/")) {
        continue
      }
      const nodes = []
      code.textContent.split("/").forEach((part, i) => {
        if (i > 0) {
          nodes.push("/", document.createElement("wbr"))
        }
        nodes.push(part)
      })
      code.replaceChildren(...nodes)
    }
  }

  /** theme.css's page background in each mode, for before Scalar sets one. */
  const BACKGROUND = { light: "#ffffff", dark: "#110f18" }

  /**
   * The browser's theme-color: the page background of the mode the page is in.
   * Scalar's head config takes no `media` on a meta tag, and the reader's
   * toggle can override the system's scheme, so one tag is written here and
   * follows the mode class Scalar puts on <body>.
   */
  const themeColor = () => {
    const classes = document.body.classList
    let dark = matchMedia("(prefers-color-scheme: dark)").matches
    if (classes.contains("dark-mode") || classes.contains("light-mode")) {
      dark = classes.contains("dark-mode")
    }
    const color =
      getComputedStyle(document.body).getPropertyValue("--scalar-background-1").trim() ||
      BACKGROUND[dark ? "dark" : "light"]
    let tag = document.querySelector('meta[name="theme-color"]')
    if (!tag) {
      tag = document.createElement("meta")
      tag.name = "theme-color"
      document.head.append(tag)
    }
    if (tag.content !== color) {
      tag.content = color
    }
  }

  const update = () => {
    structuredData()
    themeColor()
    pathBreaks()
  }

  // A burst of changes, as a route change is, is handled once, in the next frame.
  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) {
      return
    }
    queued = true
    requestAnimationFrame(() => {
      queued = false
      update()
    })
  })

  const modes = new MutationObserver(themeColor)

  const start = () => {
    update()
    observer.observe(document.body, { childList: true, subtree: true })
    // A route change retitles the page in the head, not only in the body.
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    // The colour-scheme toggle changes only <body>'s class.
    modes.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    // With no mode class the system's scheme decides, and it can change too.
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeColor)
  }
  // The browser's chrome takes its colour at once; nothing else here is on
  // screen, so the rest waits for an idle main thread rather than add to the
  // page's blocking time. Safari has no requestIdleCallback; a timeout stands in.
  const idle = () => {
    themeColor()
    window.requestIdleCallback ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 0)
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", idle)
  } else {
    idle()
  }
})()
