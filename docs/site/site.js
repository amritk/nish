/*
  The docs site's one script: it wires the animated hero on the landing page
  (the name unfolding into what it stands for, a source file compiling to its
  targets) and gives cards a highlight that follows the pointer. Everything
  the hero shows is styled, and animated, by theme.css.

  The hero is static markup in docs/guide/index.md, so the server's HTML
  paints it with the page and nothing moves when this file runs; that markup
  is `hero()` below, serialized: `node tests/break-web/check.mjs --write-hero`
  rewrites it, and the break-web check fails when the two differ. This file
  gives the markup its behaviour (the copy button, the terminal). A host left
  empty, as scripts/gen-og-image.mjs's is, gets the hero built here.
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

  /** What the name stands for: each initial, then the rest of its word. */
  const NAME = [
    ["N", "ative"],
    ["I", "nstruction"],
    ["S", "tatic"],
    ["H", "ost"],
  ]

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

  const copyButton = () =>
    el(
      "button.nish-hero__install",
      { type: "button", title: "Copy the install command" },
      el("span.nish-hero__prompt", { "aria-hidden": "true" }, "$"),
      el("code", {}, INSTALL),
      el("span.nish-hero__copied", { "aria-live": "polite" })
    )

  const bindCopy = (button) => {
    const label = button.querySelector(".nish-hero__copied")
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
  }

  /** One row of the name: each initial, then the rest of its word. */
  const nameRow = (spec) =>
    el(
      spec,
      { "aria-hidden": "true" },
      ...NAME.map(([initial, rest], index) =>
        el(
          "span.nish-hero__word",
          { style: `--i:${index}` },
          el("b", {}, initial),
          el("span.nish-hero__rest", {}, el("span", {}, rest))
        )
      )
    )

  /**
   * "NISH", whose initials open into words while hovered or focused (a tap
   * focuses it). A hidden open copy in the same grid cell holds the height.
   * A screen reader reads the label once: an img role, as a p's is not read.
   */
  const unpackedName = () =>
    el(
      "p.nish-hero__name",
      { role: "img", "aria-label": "Nish: Native Instruction Static Host", tabindex: "0" },
      nameRow("span.nish-hero__name-row"),
      nameRow("span.nish-hero__name-row.nish-hero__name-row--ghost")
    )

  const hero = () =>
    el(
      "div.nish-hero__inner",
      {},
      el("div.nish-hero__aurora", { "aria-hidden": "true" }),
      unpackedName(),
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
      // is hidden from assistive technology, all but the terminal's input.
      el(
        "div.nish-hero__stage",
        {},
        el(
          "div.nish-hero__window.nish-hero__editor",
          { "aria-hidden": "true" },
          el("div.nish-hero__bar", {}, el("i"), el("i"), el("i"), el("span", {}, "squares.ts")),
          el("pre.nish-hero__code", {}, ...SOURCE.map(codeLine))
        ),
        el(
          "div.nish-hero__flow",
          { "aria-hidden": "true" },
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
        terminal(
          el(
            "div.nish-hero__bar",
            { "aria-hidden": "true" },
            el("i"),
            el("i"),
            el("i"),
            el("span", {}, "terminal")
          ),
          el(
            "pre.nish-hero__code",
            { "aria-hidden": "true" },
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
   * The hero's terminal: a hidden input whose first use imports the shell
   * (examples/break-web). When the hero's one run ends, a prompt waits under
   * the output; the shell's own line takes its place.
   */
  const terminal = (bar, code) => {
    code.append(el("span.nish-hero__ready", {}, el("b", {}, "$ "), el("i")))
    const input = el("input.nish-hero__input", {
      "aria-label": "Terminal",
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      enterkeyhint: "go",
    })
    return el("div.nish-hero__window.nish-hero__terminal", {}, bar, code, input)
  }

  const bindTerminal = (term) => {
    const input = term.querySelector(".nish-hero__input")
    const ready = term.querySelector(".nish-hero__ready")
    term.addEventListener("click", () => getSelection().isCollapsed && input.focus())
    const lines = [] // entered while the shell loads
    let shell = null
    const first = (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        lines.push(input.value)
        input.value = ""
      } else if (event.type !== "input" && event.keyCode !== 229) {
        return
      }
      const shellUrl = "/break/shell.mjs"
      shell ??= import(shellUrl)
        .then((m) => {
          m.attach(term, input, lines, first)
          ready.remove()
        })
        .catch(() => {
          lines.length = 0
          shell = null
        })
    }
    input.addEventListener("input", first)
    input.addEventListener("keydown", first)
    // Text typed into the server's markup before this script ran loads the shell too.
    if (input.value) {
      first({ type: "input" })
    }
  }

  /** The heroes given their behaviour, and when the one on the page began: see `fill`. */
  const bound = new WeakSet()
  let began = 0

  /**
   * The site is a single-page app: the landing page's Markdown is mounted,
   * hydrated and unmounted by the framework, which may replace the hero at
   * any of those moments: on a first load the client app swaps the server's
   * page, hero and all, for its own copy. So every change to the document
   * wires whichever hero is new, building it into a host left empty. A copy
   * that replaces a wired hero in the same change carries on from where that
   * one was, as its CSS animations restart when it is inserted; a hero that
   * comes back on a later navigation plays from the start.
   */
  const fill = (records) => {
    let swapped = false
    for (const { removedNodes } of records) {
      for (const node of removedNodes) {
        const gone = node.classList?.contains("nish-hero__inner")
          ? node
          : node.querySelector?.(".nish-hero__inner")
        swapped ||= bound.has(gone)
      }
    }
    for (const host of document.querySelectorAll("[data-nish-hero]")) {
      let inner = host.querySelector(".nish-hero__inner")
      if (bound.has(inner)) {
        continue
      }
      if (inner === null) {
        host.classList.add("nish-hero")
        inner = hero()
        host.append(inner)
      }
      bound.add(inner)
      bindCopy(inner.querySelector(".nish-hero__install"))
      bindTerminal(inner.querySelector(".nish-hero__terminal"))
      const animations = inner.getAnimations?.({ subtree: true }) ?? []
      if (swapped) {
        for (const animation of animations) {
          animation.currentTime = performance.now() - began
        }
      } else {
        began = animations[0]?.startTime ?? performance.now()
      }
      host.setAttribute("data-nish-ready", "")
    }
  }

  // It runs before the browser paints the change, so no frame shows an empty host.
  const observer = new MutationObserver(fill)

  const start = () => {
    fill([])
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
