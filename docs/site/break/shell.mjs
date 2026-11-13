// The docs hero terminal's shell: everything the terminal does once it is
// typed into. docs/site/site.js makes the terminal focusable and, on its first
// key, imports this module (as /break/shell.mjs) and hands the terminal to
// `attach`, so the docs page that never types pays for none of it. The game,
// break.mjs, is a second import, made only by `nish break`.
//
// HELP and VERSION are the built compiler's own `--help` and `--version`:
// build.mjs writes them into the built copy and records a hash of the help in
// its manifest, so `--check` fails once the CLI's answer drifts from the page's.

/** `nish --help`, as the compiler prints it; build.mjs fills it in. */
export const HELP = "nish 0.39.0  a static subset of TypeScript, compiled ahead of time\n▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀      ▀▀▀▀ ▀▀▀▀ ▀▀▀▀\n\nusage: nish <file.ts> [more.ts ...] [flags]   compile to LLVM IR\n       nish run [flags] <file.ts> [args ...]  build, cache and run it\n       nish run --watch <file.ts> [args ...]  rebuild and rerun it on each edit\n       nish -v, --version | -h, --help\n\nBuild\n  -o, --output <file.ll>|<dir>/    where the IR goes; a dir gets one per module\n  --link <exe>                     link a native binary; the entry exports main\n  --profile speed|size|debug|wasi  the link recipe; speed is -O3 with LTO\n  --cpu x86-64-v3                  allow AVX2; such a binary needs it to start\n  --target <triple>|host           stamp the IR with a target's data layout\n  -g                               DWARF debug info, for gdb and lldb\n  --threads                        an arena per thread, for --emit-napi-async\n\nCheck\n  --fix                            apply the safe fixes in place, then recheck\n  --json                           each diagnostic as one JSON line on stdout\n  --warn-portability               warn where TypeScript would answer otherwise\n  --no-warn-performance            silence the performance warnings\n  --deny-panics                    refuse an unproven panic in your package\n  --deny-retention                 refuse retained arena memory in your package\n\nCapabilities\n  --capabilities                   print what the program can reach, on stderr\n  --allow <cap>[,<cap>...]         refuse a program that reaches more\n  --deny <cap>[,<cap>...]          refuse a program that reaches these\n  --deterministic                  same float bits everywhere, no clock or I/O\n  --sandbox[=best-effort]          confine a Linux binary to what main reaches\n  --emit-capabilities <file.json>  write the capability report\n  --update-capability-lock         record what each dependency reaches\n\nInterop\n  --emit-header <file.h>           a C header for the exports\n  --emit-dts <file.d.ts>           their typings, and a <file>.mjs loader\n  --host <file.ts>                 a page module whose functions wasm imports\n  --emit-napi <shim.c>             a Node-API shim, to load them from Node\n  --emit-napi-async <shim.c>       the same, plus a promise for each export\n  --emit-ts <dir>                  the program as TypeScript, instead of IR\n\nInspect\n  --emit-ast                       print the parse tree, one line per node\n  --emit-checked                   print what the checker recorded\n  --emit-panics <file.json>        list every place the program can panic\n  --emit-arena <file.json>         write the arena retention report\n  --explain-memory                 why loops and functions keep their memory\n\nCode generation\n  --number-mode i32|f64            what a bare number is; i32 by default\n  --compat                         compatibility dialect; accepts nothing yet\n  --plain                          the IR without LLVM's attributes\n  --no-strict-exports              keep every function externally visible\n  --no-stack-alloc                 keep every value off the stack\n  --runtime-decls                  declare the runtime even when unused\n\nAgents\n  before writing Nish, read the language as rules, traps first:\n  /home/user/nish/docs/AI.md\n  --json                           diagnostics as JSON lines, fixes included\n  --fix                            apply those fixes; read only what is left\n  nish run <file.ts>               what the program prints, once it compiles\n\nExit codes\n  0 ok, 1 rejected, 2 usage, 3 toolchain, 70 a compiler bug: report it\n\nExamples\n  nish run hello.ts                build, cache and run a program\n  nish app.ts --link app           write app.ll and a binary, app\n  nish --fix src/*.ts              rewrite what the compiler can fix\n  NO_COLOR=1 nish --help           this text, without colour"

/** `nish --version`, as the compiler prints it; build.mjs fills it in. */
export const VERSION = "nish 0.39.0"

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
 * Makes `term` a terminal: adds its input line, takes its keys in place of
 * site.js's `first` listener, and replays `keys`, the ones typed while this
 * module loaded. `load` imports the game; a test hands in its own.
 */
export const attach = (
  term,
  keys,
  first,
  { document = globalThis.document, load = () => import("./break.mjs") } = {}
) => {
  term.removeEventListener("keydown", first)
  const node = (tag, className, text = "") => {
    const made = document.createElement(tag)
    made.className = className
    made.textContent = text
    return made
  }
  const said = node("span", "nish-hero__said")
  said.setAttribute("aria-live", "polite")
  const typed = node("span", "")
  const line = node("pre", "nish-hero__code nish-hero__line-in")
  line.append(said, node("b", "", "$ "), typed, node("i", "nish-hero__caret"))
  term.append(line)

  let opening = null
  const say = (text) => (said.textContent = text)
  const run = (command) => {
    const out = answer(command)
    if (out !== OPEN) {
      say(command === "" ? "" : `$ ${command}\n${out}\n`)
      return
    }
    say(`$ ${command}\nloading…\n`)
    opening ??= load()
    opening
      .then((game) => game.open({ focus: term, say: (text) => say(`$ ${command}\n${text}\n`) }))
      .then(() => say(""))
      .catch((error) => {
        opening = null
        say(`$ ${command}\nnish break: ${error.message}\n`)
      })
  }
  /** Takes one key; false if the terminal has no use for it. */
  const take = (key) => {
    const text = typed.textContent
    if (key === "Enter") {
      typed.textContent = ""
      run(text.trim())
    } else if (key === "Backspace") {
      typed.textContent = text.slice(0, -1)
    } else if (key.length === 1) {
      typed.textContent = text.length < LINE ? text + key : text
    } else {
      return false
    }
    return true
  }
  for (const key of keys) {
    take(key)
  }
  term.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey || event.altKey) && take(event.key)) {
      event.preventDefault()
    }
  })
}
