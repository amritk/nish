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
export const HELP = "nish 0.39.0  a static subset of TypeScript, compiled ahead of time\n▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀      ▀▀▀▀ ▀▀▀▀ ▀▀▀▀\n\nusage: nish <file.ts> [more.ts ...] [flags]   compile to LLVM IR\n       nish run [flags] <file.ts> [args ...]  build, cache and run it\n       nish run --watch <file.ts> [args ...]  rebuild and rerun it on each edit\n       nish upgrade [<version>] [--check]     install a newer release\n       nish -v, --version | -h, --help\n\nBuild\n  -o, --output <file.ll>|<dir>/    where the IR goes; a dir gets one per module\n  --link <exe>                     link a native binary; the entry exports main\n  --profile speed|size|debug|wasi  the link recipe; speed is -O3 with LTO\n  --cpu x86-64-v3                  allow AVX2; such a binary needs it to start\n  --target <triple>|host           stamp the IR with a target's data layout\n  -g                               DWARF debug info, for gdb and lldb\n  --threads                        an arena per thread, for --emit-napi-async\n\nCheck\n  --fix                            apply the safe fixes in place, then recheck\n  --json                           each diagnostic as one JSON line on stdout\n  --warn-portability               warn where TypeScript would answer otherwise\n  --no-warn-performance            silence the performance warnings\n  --deny-panics                    refuse an unproven panic in your package\n  --deny-retention                 refuse retained arena memory in your package\n\nCapabilities\n  --capabilities                   print what the program can reach, on stderr\n  --allow <cap>[,<cap>...]         refuse a program that reaches more\n  --deny <cap>[,<cap>...]          refuse a program that reaches these\n  --deterministic                  same float bits everywhere, no clock or I/O\n  --sandbox[=best-effort]          confine a Linux binary to what main reaches\n  --emit-capabilities <file.json>  write the capability report\n  --update-capability-lock         record what each dependency reaches\n\nInterop\n  --emit-header <file.h>           a C header for the exports\n  --emit-dts <file.d.ts>           their typings, and a <file>.mjs loader\n  --host <file.ts>                 a page module whose functions wasm imports\n  --emit-napi <shim.c>             a Node-API shim, to load them from Node\n  --emit-napi-async <shim.c>       the same, plus a promise for each export\n  --emit-ts <dir>                  the program as TypeScript, instead of IR\n\nInspect\n  --emit-ast                       print the parse tree, one line per node\n  --emit-checked                   print what the checker recorded\n  --emit-panics <file.json>        list every place the program can panic\n  --emit-arena <file.json>         write the arena retention report\n  --explain-memory                 why loops and functions keep their memory\n\nCode generation\n  --number-mode i32|f64            what a bare number is; i32 by default\n  --compat                         compatibility dialect; accepts nothing yet\n  --plain                          the IR without LLVM's attributes\n  --no-strict-exports              keep every function externally visible\n  --no-stack-alloc                 keep every value off the stack\n  --runtime-decls                  declare the runtime even when unused\n\nExit codes\n  0 ok, 1 rejected, 2 usage, 3 toolchain, 70 a compiler bug: report it\n\nExamples\n  nish run hello.ts                build, cache and run a program\n  nish app.ts --link app           write app.ll and a binary, app\n  nish --fix src/*.ts              rewrite what the compiler can fix\n  NO_COLOR=1 nish --help           this text, without colour"

/** `nish --version`, as the compiler prints it; build.mjs fills it in. */
export const VERSION = "nish 0.39.0"

/** What `answer` gives for the one command that opens the game rather than printing. */
export const OPEN = Symbol("open")

/** The words one guess away from `nish break`: src/compile.ts's `nearMiss`. */
const NEAR = new Set(["brick", "bricks", "breakout", "game", "play"])

/** The longest line the terminal takes. */
const LINE = 40

/**
 * The live terminal's look, kept out of theme.css so a page that never types
 * loads none of it. Once attached (--live), the terminal's part of the hero's
 * one run jumps to its end, so a line typed before the run is over still lands
 * under the output; the caret blinks while the terminal has focus.
 */
const css = `
.nish-hero__terminal--live *{animation:none}
.nish-hero__terminal .nish-hero__line-in{padding-top:0}
.nish-hero__said{display:block;max-height:16em;overflow:auto;color:var(--scalar-color-2)}
.nish-hero__caret{display:inline-block;width:.6em;height:1.1em;vertical-align:text-bottom;
background:var(--scalar-color-accent);opacity:.25}
.nish-hero__terminal:focus-within .nish-hero__caret{opacity:1;animation:nish-caret 1s steps(1,end) infinite}
@keyframes nish-caret{50%{opacity:0}}
`

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
  // Live for good: the hero's looping animation stops (`css`).
  term.classList.add("nish-hero__terminal--live")
  const node = (tag, className, text = "") => {
    const made = document.createElement(tag)
    made.className = className
    made.textContent = text
    return made
  }
  term.append(node("style", "", css))
  // A form, so a keyboard's go key that sends no Enter keydown (an IME's 229)
  // still enters the line, as a submit. The input joins it by its `form`
  // attribute, not by moving into it: moving a focused element blurs it, and
  // the keys typed while this module loaded would go nowhere after the first.
  const form = node("form", "nish-hero__form")
  form.id = "nish-hero-form"
  form.setAttribute("autocomplete", "off")
  term.append(form)
  input.setAttribute("form", form.id)
  // Whether the last input was a touch rather than a key or a mouse: then
  // closing the game hands focus to nothing, so no soft keyboard springs up
  // over the page. Until the first event, a coarse pointer counts as a touch.
  let touched = document.defaultView?.matchMedia?.("(pointer: coarse)")?.matches ?? false
  term.addEventListener("pointerdown", (event) => {
    touched = event.pointerType === "touch"
  })
  // A soft keyboard's composing key (229) says nothing of a hardware one.
  term.addEventListener("keydown", (event) => {
    touched &&= event.keyCode === 229
  })
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
      .then((game) =>
        game.open({ focus: touched ? null : input, say: (text) => say(`$ ${command}\n${text}\n`) })
      )
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
  const enter = (event) => {
    event.preventDefault()
    const entered = input.value
    input.value = ""
    show()
    run(entered)
  }
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      enter(event)
    }
  })
  form.addEventListener("submit", enter)
}
