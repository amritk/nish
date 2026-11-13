/*
  The docs site's one script: it builds the animated hero on the landing page
  (the name unfolding into what it stands for, a source file compiling to its
  targets) and gives cards a highlight that follows the pointer. Everything it draws is
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
   * The name, unpacked: it reads "NISH" and then each initial unfolds into its
   * word. The row is drawn twice in one grid cell: a hidden copy, never
   * animated, holds the unfolded name's height, so a narrow screen where it
   * wraps onto more lines than "NISH" takes does not push the page down as it
   * opens. A screen reader gets the whole phrase once, from the label, rather
   * than eight fragments.
   */
  const unpackedName = () =>
    el(
      "p.nish-hero__name",
      { "aria-label": "Nish: Native Instruction Static Host" },
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
   * (examples/break-web). Hovered or focused it is held, with a prompt under
   * the loop's output, or alone ("blank") if none is on screen.
   */
  const terminal = (bar, code) => {
    const input = el("input.nish-hero__input", {
      "aria-label": "Terminal",
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      enterkeyhint: "go",
    })
    const ready = el("span.nish-hero__ready", {}, el("b", {}, "$ "), el("i"))
    code.append(ready)
    const term = el("div.nish-hero__window.nish-hero__terminal", {}, bar, code, input)
    const lines = [] // entered while the shell loads
    let shell = null
    let hovered = false
    // Leaving blurs the input only if hovering focused it.
    let byHover = false
    const hold = () => {
      if (term.hasAttribute("data-held")) {
        return
      }
      // nish-hero-cmd types from 43%; nish-hero-show fades by 86%.
      const at = code.getAnimations?.()[0]?.effect.getComputedTiming().progress
      term.style.minHeight = `${term.clientHeight}px`
      term.setAttribute("data-held", at < 0.43 || at >= 0.85 ? "blank" : "")
    }
    const release = () => {
      if (shell === null && !hovered && document.activeElement !== input) {
        term.removeAttribute("data-held")
        term.style.minHeight = ""
      }
    }
    term.addEventListener("click", () => {
      byHover = false
      getSelection().isCollapsed && input.focus()
    })
    // A mouse focuses the input only when no other field has focus.
    term.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        hovered = true
        hold()
        if (document.activeElement === document.body) {
          byHover = true
          input.focus({ preventScroll: true })
        }
      }
    })
    term.addEventListener("pointerleave", () => {
      hovered = false
      byHover && shell === null ? input.blur() : release()
    })
    input.addEventListener("focus", hold)
    input.addEventListener("blur", () => {
      byHover = false
      release()
    })
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
    return term
  }

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
    // theme.css holds the page under an unready host hidden, so the hero's
    // arrival moves nothing a reader can see. Ready waits two frames: the
    // frame that lays the hero out still hides the page it pushed down, and
    // the page shows where it will stay.
    for (const host of document.querySelectorAll("[data-nish-hero]:not(:empty):not([data-nish-ready])")) {
      requestAnimationFrame(() => requestAnimationFrame(() => host.setAttribute("data-nish-ready", "")))
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
