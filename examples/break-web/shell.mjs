// The docs hero terminal's shell: everything the terminal does once it is
// typed into. docs/site/site.js gives the terminal a hidden input (so a tap
// opens a soft keyboard) and, on its first use, imports this module (as
// /break/shell.mjs) and hands the terminal to `attach`, so the docs page that
// never types pays for none of it. The game,
// break.mjs, is a second import, made only by `nish break`.
//
// HELP and VERSION are the built compiler's own `--help` and `--version`:
// build.mjs writes them into the built copy and records a hash of the help in
// its manifest, so `--check` fails once the CLI's answer drifts from the page's.

/** `nish --help`, as the compiler prints it; build.mjs fills it in. */
export const HELP = ""

/** `nish --version`, as the compiler prints it; build.mjs fills it in. */
export const VERSION = ""

/** What `answer` gives for the one command that opens the game rather than printing. */
export const OPEN = Symbol("open")

/** The words one guess away from `nish break`: src/compile.ts's `nearMiss`. */
const NEAR = new Set(["brick", "bricks", "breakout", "game", "play"])

/** The longest line the terminal takes. */
const LINE = 40

/**
 * The terminal's answer to `line`: the text to print under it, "" for none,
 * or OPEN for `nish break`.
 */
export const answer = (line) => {
  const words = line
    .trim()
    .split(/\s+/)
    .filter((w) => w !== "")
  if (words.length === 0) {
    return ""
  }
  if (words[0] !== "nish") {
    return `${words[0]}: not on this page's PATH. try nish --help`
  }
  const [, first, ...rest] = words
  if (first === undefined || ((first === "-h" || first === "--help") && rest.length === 0)) {
    return HELP
  }
  if ((first === "-v" || first === "--version") && rest.length === 0) {
    return VERSION
  }
  if (first === "break" && rest.length === 0) {
    return OPEN
  }
  // src/compile.ts's riddle, word for word.
  if (NEAR.has(first) && rest.length === 0) {
    return `no file named ${first}. every loop needs one, though.`
  }
  return "nish: this terminal compiles nothing; nish --help says what a real one does"
}

/**
 * Makes `term` a terminal over `input`, its hidden text field: shows what is
 * typed in it, answers each line entered, and takes the input's events in
 * place of site.js's `first` listener. `lines` are the ones entered while this
 * module loaded, answered first. `load` imports the game; a test hands in its
 * own.
 */
export const attach = (
  term,
  input,
  lines,
  first,
  { document = globalThis.document, load = () => import("./break.mjs") } = {}
) => {
  input.removeEventListener("input", first)
  input.removeEventListener("keydown", first)
  input.maxLength = LINE
  // Live for good: the hero's looping animation stops (theme.css).
  term.classList.add("nish-hero__terminal--live")
  const node = (tag, className, text = "") => {
    const made = document.createElement(tag)
    made.className = className
    made.textContent = text
    return made
  }
  // A screen reader hears the input itself as it is typed, and each answer
  // through `said`; the drawn copy of the line is for the eye only.
  const said = node("span", "nish-hero__said")
  said.setAttribute("aria-live", "polite")
  const typed = node("span", "")
  const shown = node("span", "")
  shown.setAttribute("aria-hidden", "true")
  shown.append(node("b", "", "$ "), typed, node("i", "nish-hero__caret"))
  const line = node("pre", "nish-hero__code nish-hero__line-in")
  line.append(said, shown)
  term.append(line)

  let opening = null
  const say = (text) => (said.textContent = text)
  const run = (entered) => {
    const command = entered.slice(0, LINE).trim()
    const out = answer(command)
    if (out !== OPEN) {
      say(command === "" ? "" : `$ ${command}\n${out}\n`)
      return
    }
    say(`$ ${command}\nloading…\n`)
    opening ??= load()
    opening
      .then((game) => game.open({ focus: input, say: (text) => say(`$ ${command}\n${text}\n`) }))
      .then(() => say(""))
      .catch((error) => {
        opening = null
        say(`$ ${command}\nnish break: ${error.message}\n`)
      })
  }
  const show = () => {
    input.value = input.value.slice(0, LINE)
    typed.textContent = input.value
  }
  for (const entered of lines.splice(0)) {
    run(entered)
  }
  show()
  input.addEventListener("input", show)
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault()
      const entered = input.value
      input.value = ""
      show()
      run(entered)
    }
  })
}
