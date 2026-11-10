/*
  The docs site's one script: it builds the animated hero on the landing page
  and gives cards a highlight that follows the pointer. Everything it draws is
  styled, and animated, by theme.css; with this file missing the pages read
  the same, without the hero.

  The hero's host is `<div data-nish-hero></div>` in docs/guide/index.md, left
  empty so that GitHub, which renders the same Markdown, shows nothing there.
*/
;(() => {
  if (window.__nishSite) {
    return
  }
  window.__nishSite = true

  const INSTALL = "curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh"

  /** The program the hero types: the one "A first look" shows further down the page. */
  const SOURCE = [
    [["k", "const"], " sumOfSquares = (limit: ", ["t", "i32"], "): ", ["t", "i32"], " => {"],
    ["  ", ["k", "let"], " total = ", ["n", "0"], ";"],
    ["  ", ["k", "for"], " (", ["k", "let"], " i = ", ["n", "1"], "; i <= limit; i++) {"],
    ["    total = total + i * i;"],
    ["  }"],
    ["  ", ["k", "return"], " total;"],
    ["};"],
  ]

  const TARGETS = ["x86_64", "ARM64", "WebAssembly"]

  /** `el("div.a.b", { attr }, ...children)`: the few lines of DOM building the hero needs. */
  const el = (spec, attrs = {}, ...children) => {
    const [tag, ...classes] = spec.split(".")
    const node = document.createElement(tag)
    if (classes.length > 0) {
      node.className = classes.join(" ")
    }
    for (const [name, value] of Object.entries(attrs)) {
      node.setAttribute(name, value)
    }
    node.append(...children)
    return node
  }

  const SVG = "http://www.w3.org/2000/svg"
  const svg = (tag, attrs) => {
    const node = document.createElementNS(SVG, tag)
    for (const [name, value] of Object.entries(attrs)) {
      node.setAttribute(name, value)
    }
    return node
  }

  const codeLine = (parts, index) =>
    el(
      "span.nish-hero__line",
      { style: `--i:${index}` },
      ...parts.map((part) => (typeof part === "string" ? part : el(`span.nish-tok-${part[0]}`, {}, part[1])))
    )

  /**
   * The beams from the source to the compiler and on to each target. A beam
   * is drawn twice: a faint rail, and a short bright dash that travels along
   * it. `pathLength="100"` lets the CSS move every dash by the same numbers
   * whatever the curve's real length.
   */
  const beams = () => {
    const root = svg("svg", {
      class: "nish-hero__beams",
      viewBox: "0 0 300 200",
      preserveAspectRatio: "none",
      "aria-hidden": "true",
    })
    const paths = [
      ["in", "M0 100 H120"],
      ["out", "M180 100 C230 100 240 34 300 34"],
      ["out", "M180 100 H300"],
      ["out", "M180 100 C230 100 240 166 300 166"],
    ]
    let out = 0
    for (const [kind, d] of paths) {
      const index = kind === "out" ? out++ : 0
      root.append(
        svg("path", { class: "nish-hero__rail", d, "vector-effect": "non-scaling-stroke" }),
        svg("path", {
          class: `nish-hero__pulse nish-hero__pulse--${kind}`,
          d,
          pathLength: "100",
          style: `--i:${index}`,
          "vector-effect": "non-scaling-stroke",
        })
      )
    }
    return root
  }

  const copyButton = () => {
    const label = el("span.nish-hero__copied", { "aria-live": "polite" })
    const button = el(
      "button.nish-hero__install",
      { type: "button", title: "Copy the install command" },
      el("span.nish-hero__prompt", { "aria-hidden": "true" }, "$"),
      el("code", {}, INSTALL),
      label
    )
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(INSTALL)
        label.textContent = "Copied"
      } catch {
        // No clipboard (an insecure origin, a denied permission): the command
        // is still on screen to select by hand, so say so rather than fail silently.
        label.textContent = "Select to copy"
      }
      setTimeout(() => {
        label.textContent = ""
      }, 1800)
    })
    return button
  }

  const hero = () =>
    el(
      "div.nish-hero__inner",
      {},
      el("div.nish-hero__aurora", { "aria-hidden": "true" }),
      el("p.nish-hero__title", {}, "TypeScript in. ", el("span.nish-hero__accent", {}, "Native code out.")),
      el(
        "div.nish-hero__actions",
        {},
        el(
          "a.nish-hero__cta",
          { href: "/getting-started/installation" },
          "Get started",
          el("span", { "aria-hidden": "true" }, "→")
        ),
        copyButton()
      ),
      // The stage is a picture of what the text beside it already says, so it
      // is hidden from assistive technology rather than read out line by line.
      el(
        "div.nish-hero__stage",
        { "aria-hidden": "true" },
        el(
          "div.nish-hero__window.nish-hero__editor",
          {},
          el("div.nish-hero__bar", {}, el("i"), el("i"), el("i"), el("span", {}, "squares.ts")),
          el("pre.nish-hero__code", {}, ...SOURCE.map(codeLine))
        ),
        el(
          "div.nish-hero__flow",
          {},
          beams(),
          el(
            "div.nish-hero__core",
            {},
            el("span.nish-hero__ring"),
            el("img", { src: "/mark.svg", alt: "", width: "52", height: "52" })
          ),
          el(
            "div.nish-hero__targets",
            {},
            ...TARGETS.map((name, index) => el("span.nish-hero__target", { style: `--i:${index}` }, name))
          )
        ),
        el(
          "div.nish-hero__window.nish-hero__terminal",
          {},
          el("div.nish-hero__bar", {}, el("i"), el("i"), el("i"), el("span", {}, "terminal")),
          el(
            "pre.nish-hero__code",
            {},
            el(
              "span.nish-hero__cmd",
              {},
              el("b", {}, "$ "),
              el("span.nish-hero__typed", {}, "nish run squares.ts")
            ),
            el("span.nish-hero__out", {}, "1² + … + 10² = 385")
          )
        )
      )
    )

  /**
   * The site is a single-page app: the landing page's Markdown is mounted,
   * hydrated and unmounted by the framework, which may replace the host at
   * any of those moments. So rather than build once on load, every change to
   * the document refills whichever host is empty.
   */
  const fill = () => {
    for (const host of document.querySelectorAll("[data-nish-hero]:empty")) {
      host.classList.add("nish-hero")
      host.append(hero())
    }
  }

  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) {
      return
    }
    queued = true
    requestAnimationFrame(() => {
      queued = false
      fill()
    })
  })

  const start = () => {
    fill()
    observer.observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start)
  } else {
    start()
  }

  // The card highlight: theme.css paints a radial glow at (--nish-x, --nish-y).
  document.addEventListener(
    "pointermove",
    (event) => {
      const card = event.target instanceof Element ? event.target.closest(".t-editor__card") : null
      if (!card) {
        return
      }
      const box = card.getBoundingClientRect()
      card.style.setProperty("--nish-x", `${event.clientX - box.left}px`)
      card.style.setProperty("--nish-y", `${event.clientY - box.top}px`)
    },
    { passive: true }
  )
})()
