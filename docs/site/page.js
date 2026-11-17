/*
  What every docs page gets besides the hero (which is site.js): the pages'
  structured data (JSON-LD) for search and answer engines, and a path in a
  table that may break at its slashes. It draws nothing; with this file
  missing the pages read the same.
*/
;(() => {
  if (window.__nishPage) {
    return
  }
  window.__nishPage = true

  const SITE = "https://nishlang.com"
  const DESCRIPTION =
    "Nish compiles a strict, static subset of TypeScript ahead of time to native executables for x86_64, ARM64 and WebAssembly through LLVM, with no interpreter and no garbage collector."

  /** What Nish is, the same on every page. Nothing here names a person. */
  const PROJECT = [
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "Nish", inLanguage: "en" },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#software`,
      name: "Nish",
      alternateName: "Native Instruction Static Host",
      description: DESCRIPTION,
      url: `${SITE}/`,
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
   * any other page than the home page, what that page is, read from the title
   * and description Scalar has put in the head. Scalar renders none of its
   * own. The site is a single-page app, so the block is rewritten whenever the
   * route or the head changes, and only when its text would differ, so its
   * own write does not start another.
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
        headline: document.title.replace(/\s+[|·–—-]\s+Nish$/, ""),
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

  const update = () => {
    structuredData()
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

  const start = () => {
    update()
    observer.observe(document.body, { childList: true, subtree: true })
    // A route change retitles the page in the head, not only in the body.
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start)
  } else {
    start()
  }
})()
