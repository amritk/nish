// Checks the docs hero terminal (docs/site/site.js and its shell), and the page side of the game
// (examples/break-web/break.mjs) under Node, with a small fake DOM; then plays
// the built docs/site/break/game.wasm against break_core_wasm's frames and
// runs build.mjs --check on a copy of the build. Prints one
// `ok <name>` or `not ok <name>\t<detail>` line per check, then `checks: <n>`;
// the `break-web` section of tests/run.js turns each line into a check and
// compares the count, so a run cut short is caught.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import zlib from "node:zlib"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
// The compiler whose answers the hero terminal repeats: tests/run.js passes its own.
const nish = path.resolve(process.argv[2] ?? path.join(root, "build", "nish"))
const results = []
const check = (name, ok, detail) => {
  results.push(ok ? `ok ${name}` : `not ok ${name}\t${detail === undefined ? "" : String(detail).replace(/\n/g, " ")}`)
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// --- A fake DOM: the few calls site.js and break.mjs make --------------------

class Node {
  constructor(tag) {
    this.tag = tag
    this.children = []
    this.parent = null
    this.attributes = {}
    this.className = ""
    this.listeners = new Map()
    this.focused = 0
    this.text = ""
    this.value = ""
    this.maxLength = -1
    // The fake document that made it, whose activeElement focus and removal move.
    this.doc = null
    const node = this
    this.classList = { add: (c) => (node.className = `${node.className} ${c}`.trim()) }
    this.style = { setProperty: () => {} }
  }
  get textContent() {
    return this.text + this.children.map((c) => (typeof c === "string" ? c : c.textContent)).join("")
  }
  set textContent(value) {
    this.text = String(value)
    this.children = []
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value)
  }
  append(...children) {
    for (const child of children) {
      if (child instanceof Node) {
        child.remove()
        child.parent = this
      }
      this.children.push(child)
    }
  }
  /** Whether `other` is this element or one below it. */
  contains(other) {
    return other === this || [...this.all()].includes(other)
  }
  /** Removed or moved, as a browser does, a focused element (or one holding it) loses focus to the body. */
  remove() {
    if (this.doc !== null && this.contains(this.doc.activeElement)) {
      this.doc.activeElement = this.doc.body
    }
    if (this.parent !== null) {
      this.parent.children = this.parent.children.filter((c) => c !== this)
      this.parent = null
    }
  }
  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener))
  }
  dispatch(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
  focus() {
    this.focused++
    if (this.doc !== null) {
      this.doc.activeElement = this
    }
  }
  /** Every element below this one, depth first. */
  *all() {
    for (const child of this.children) {
      if (child instanceof Node) {
        yield child
        yield* child.all()
      }
    }
  }
  /** The first element below this one with tag `tag`: the one selector break.mjs asks for. */
  querySelector(tag) {
    return [...this.all()].find((n) => n.tag === tag) ?? null
  }
  find(className) {
    return [...this.all()].find((n) => n.className.split(" ").includes(className)) ?? null
  }
}

const makeDocument = () => {
  const body = new Node("body")
  const host = new Node("div")
  body.append(host)
  const made = (tag) => {
    const node = new Node(tag)
    node.doc = document
    return node
  }
  const document = {
    body,
    activeElement: body,
    readyState: "complete",
    createElement: made,
    createElementNS: (_ns, tag) => made(tag),
    querySelectorAll: () => (host.children.length === 0 ? [host] : []),
    addEventListener: () => {},
  }
  return { document, host }
}

/** An event of `type` with what the handlers read, and a record of preventDefault. */
const event = (type, fields = {}) => {
  const made = { type, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, prevented: false, ...fields }
  made.preventDefault = () => (made.prevented = true)
  return made
}
/** A keydown of `key` on `node`. */
const press = (node, key, fields = {}) => {
  const made = event("keydown", { key, target: node, ...fields })
  node.dispatch("keydown", made)
  return made
}
/** Types `text` into the input `node`, as a soft keyboard does: its value changes, then an input event. */
const typeIn = (node, text) => {
  node.value += text
  node.dispatch("input", event("input"))
}
/** Types `text` as a keyboard does: into whatever has focus, so nothing when the input has lost it. */
const typeFocused = (document, text) => {
  const node = document.activeElement
  if (node?.tag === "input") {
    typeIn(node, text)
  }
}
/** Types `line` into `node`, then Enter. */
const enter = (node, line) => {
  typeIn(node, line)
  press(node, "Enter")
}

// --- site.js: the terminal costs the page one dynamic import -----------------

const siteFile = path.join(root, "docs", "site", "site.js")
const site = fs.readFileSync(siteFile, "utf8")
const imports = [...site.matchAll(/\bimport\b\s*(\(|[^(\s])/g)]
check(
  "site.js reaches /break/ only through one dynamic import of its shell",
  imports.length === 1 && imports[0][1] === "(" && /\bconst shellUrl = "\/break\/shell\.mjs"[^]*\bimport\(shellUrl\)/.test(site),
  imports.map((m) => m[0]).join(", ")
)
// Nothing else reaches /break/ before it is asked for: no preload, no module
// worker, no fetch, no word of the game's module or its .wasm.
check(
  "site.js names /break/ nowhere but that import",
  !/\.wasm\b|break\.mjs|modulepreload|\bpreload\b|\bprefetch\b|\bfetch\(|\bWorker\(/.test(site) &&
    site.split(/["'`]\/break\//).length === 2,
  "site.js mentions .wasm, break.mjs, a preload, a fetch or a worker, or quotes a /break/ path twice"
)

// The hero's script ships on every docs page, so all the terminal does lives in
// the lazy shell: site.js may grow by under 400 B gzipped for it. The baseline
// is site.js on main before the terminal took keys (71c41439).
const SITE_GZIP_BEFORE = 3480
const SITE_GZIP_GROWTH = 400
const gzipped = zlib.gzipSync(site, { level: 9 }).length
check(
  `site.js grows by under ${SITE_GZIP_GROWTH} B gzipped`,
  gzipped - SITE_GZIP_BEFORE < SITE_GZIP_GROWTH,
  `${gzipped} B gzipped, ${SITE_GZIP_BEFORE} B before`
)

// The terminal's look before it is used ships in theme.css on every docs page
// too; the rest comes with the shell. The baseline is theme.css on main
// (c6c797f9b) before the terminal took keys.
const THEME_GZIP_BEFORE = 8956
const THEME_GZIP_GROWTH = 250
const themeGzipped = zlib.gzipSync(fs.readFileSync(path.join(root, "docs", "site", "theme.css")), { level: 9 }).length
check(
  `theme.css grows by under ${THEME_GZIP_GROWTH} B gzipped`,
  themeGzipped - THEME_GZIP_BEFORE < THEME_GZIP_GROWTH,
  `${themeGzipped} B gzipped, ${THEME_GZIP_BEFORE} B before`
)
check(
  "the live terminal's caret and output are styled by the shell, not theme.css",
  !/nish-hero__(caret|said|line-in)|nish-hero__terminal--live|nish-caret/.test(
    fs.readFileSync(path.join(root, "docs", "site", "theme.css"), "utf8")
  )
)

/**
 * Runs site.js in a fresh fake document. Its `import(...)` goes to
 * `load(specifier)`, so a test decides what the import does.
 */
const runSite = (load) => {
  const { document, host } = makeDocument()
  const window = {}
  // What the page has selected: a test selects text with `selection.isCollapsed = false`.
  const selection = { isCollapsed: true }
  const run = new Function(
    "document",
    "window",
    "MutationObserver",
    "requestAnimationFrame",
    "Element",
    "getSelection",
    "load",
    site.replace(/\bimport\(/g, "load(")
  )
  run(document, window, class { observe() {} }, () => {}, Node, () => selection, load)
  return { document, host, selection, terminal: host.find("nish-hero__terminal") }
}

{
  // A shell that cannot be fetched.
  const asked = []
  const hero = runSite((specifier) => {
    asked.push(specifier)
    return Promise.reject(new Error("Failed to fetch dynamically imported module"))
  })
  const input = hero.terminal?.find("nish-hero__input")
  const a = input?.attributes ?? {}
  check(
    "site.js gives the hero terminal a text input a soft keyboard can type into",
    input?.tag === "input" && a.autocapitalize === "off" && a.autocorrect === "off" && a.spellcheck === "false" &&
      a.enterkeyhint === "go" && a["aria-label"] !== undefined,
    JSON.stringify(a)
  )
  check("the terminal itself claims no role or focus of its own", hero.terminal?.attributes.role === undefined &&
    hero.terminal?.attributes.tabindex === undefined, JSON.stringify(hero.terminal?.attributes))
  hero.terminal.dispatch("click", event("click"))
  check("a tap on the terminal focuses its input, inside the tap", input.focused === 1, input.focused)
  hero.selection.isCollapsed = false
  hero.terminal.dispatch("click", event("click"))
  hero.selection.isCollapsed = true
  check("a click that selected text in the terminal leaves the selection, and focus, alone", input.focused === 1, input.focused)
  check("site.js imports nothing before the input is used", asked.length === 0, asked.join(", "))
  const ctrl = press(input, "r", { ctrlKey: true })
  const tab = press(input, "Tab")
  check("the input leaves shortcuts and Tab alone, and imports nothing for them", !ctrl.prevented && !tab.prevented && asked.length === 0,
    asked.join(", "))
  typeIn(input, "l")
  typeIn(input, "s")
  check("the first input asks for the shell once, and nothing else", asked.join(", ") === "/break/shell.mjs", asked.join(", "))
  await settle()
  typeIn(input, "x")
  check("an input after a failed import asks for the shell again", asked.length === 2, asked.join(", "))
  await settle()
  press(input, "Unidentified", { keyCode: 229 })
  check("an IME's keydown (229), which may type unseen, asks for the shell too", asked.length === 3, asked.join(", "))
}

{
  // A failed import forgets the lines entered while it was tried: a later one does not answer them, long after.
  const attached = []
  let fail = true
  const hero = runSite(() =>
    fail ? Promise.reject(new Error("offline")) : Promise.resolve({ attach: (term, input, lines) => attached.push([...lines]) })
  )
  const input = hero.terminal.find("nish-hero__input")
  enter(input, "ls")
  await settle()
  await settle()
  fail = false
  typeIn(input, "n")
  await settle()
  await settle()
  check("a failed import drops the lines entered while it was tried", attached.length === 1 && attached[0].length === 0,
    JSON.stringify(attached))
}

{
  // A shell that loads but whose attach throws: no unhandled rejection, and the next use asks again.
  const asked = []
  const unhandled = []
  const onUnhandled = (reason) => unhandled.push(reason)
  process.on("unhandledRejection", onUnhandled)
  const hero = runSite(() => {
    asked.push(1)
    return Promise.resolve({ attach: () => { throw new Error("attach failed") } })
  })
  const input = hero.terminal.find("nish-hero__input")
  typeIn(input, "n")
  await settle()
  await settle()
  typeIn(input, "i")
  await settle()
  await settle()
  process.off("unhandledRejection", onUnhandled)
  check("a shell whose attach fails is asked for again, with no unhandled rejection", asked.length === 2 && unhandled.length === 0,
    `${asked.length} ${unhandled}`)
}

{
  // A shell that loads: site.js hands it the terminal, its input, the lines
  // entered while it loaded, and its own listener to take down.
  const attached = []
  const hero = runSite(() => Promise.resolve({ attach: (...args) => attached.push([...args, [...args[2]]]) }))
  const input = hero.terminal.find("nish-hero__input")
  enter(input, "ls")
  typeIn(input, "nish")
  await settle()
  const [term, given, , first, lines] = attached[0] ?? []
  check(
    "the loaded shell gets the terminal, its input, each line entered while it loaded, and site.js's listener",
    attached.length === 1 && term === hero.terminal && given === input && lines.join("|") === "ls" && input.value === "nish" &&
      input.listeners.get("input")?.includes(first) && input.listeners.get("keydown")?.includes(first),
    JSON.stringify(attached.map((x) => x[4]))
  )
}

// --- shell.mjs: what the terminal answers ------------------------------------

// The served shell, as build.mjs fills it in from the compiler.
const shellFile = path.join(root, "docs", "site", "break", "shell.mjs")
const shell = fs.existsSync(shellFile) ? await import(pathToFileURL(shellFile).href) : null
check("docs/site/break/shell.mjs is built", shell !== null, shellFile)
// The compiler as build.mjs asks it: as a person at a terminal sees it, not an
// agent, so whoever runs this gets the same answers.
const person = (colour) => {
  const env = { ...process.env, NISH_AGENT: "0" }
  for (const name of ["CLAUDECODE", "GEMINI_CLI", "NO_COLOR", "FORCE_COLOR", "CLICOLOR_FORCE"]) {
    delete env[name]
  }
  return colour ? { ...env, FORCE_COLOR: "1" } : { ...env, NO_COLOR: "1" }
}
const asks = (args, cwd, env = person(false)) => spawnSync(nish, args, { cwd, env, encoding: "utf8" })
{
  const help = asks(["--help"])
  const wanted = help.stdout.replace(/\n$/, "")
  check("the shell's nish --help is the compiler's", shell?.answer("nish --help") === wanted && help.status === 0,
    `${help.status}: ${help.stdout.slice(0, 80)}`)
  // The game's intro breaks the help apart as the terminal game's does: the
  // same text, in its colours (src/break.ts passes helpText(new Style(true, true), "")).
  const helpTs = fs.readFileSync(path.join(root, "examples", "break-web", "help.ts"), "utf8")
  const gameHelp = JSON.parse(/export const BREAK_HELP: string =\n  ("(?:[^"\\]|\\.)*")\n/.exec(helpTs)?.[1] ?? "null")
  const coloured = asks(["--help"], undefined, person(true))
  check("the game's help is the compiler's --help in its colours", gameHelp === coloured.stdout.replace(/\n$/, "") &&
    gameHelp.includes("\u001b["), String(gameHelp).slice(0, 80))
  const named = [root, "docs/AI.md", os.homedir()].filter((p) => [shell?.HELP, gameHelp].some((h) => String(h).includes(p)))
  check("neither help names a path on the machine that built it", named.length === 0, named.join(", "))
  check("the shell's bare nish prints the same help", shell?.answer("nish") === shell?.HELP && shell?.HELP !== "")
  const version = asks(["--version"])
  check("the shell's nish --version is the compiler's", shell?.answer("nish --version") === version.stdout.replace(/\n$/, ""),
    `${shell?.VERSION} vs ${version.stdout}`)
  // The riddle: the same words, and word for word what the compiler says where
  // no file of that name is.
  const compile = fs.readFileSync(path.join(root, "src", "compile.ts"), "utf8")
  const near = /const nearMiss =[^\n]*\n([^\n]*)/.exec(compile)?.[1] ?? ""
  const words = [...near.matchAll(/word === "(\w+)"/g)].map((m) => m[1])
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "break-web-"))
  const differ = []
  for (const word of words) {
    const said = asks([word], empty)
    if (said.status !== 1 || shell?.answer(`nish ${word}`) !== said.stderr.replace(/\n$/, "")) {
      differ.push(`${word}: ${said.status} ${said.stderr}`)
    }
  }
  fs.rmSync(empty, { recursive: true })
  check("the shell's riddle is the compiler's, for each of its words", words.length === 5 && differ.length === 0,
    `${words.join(" ")}; ${differ.join("; ")}`)
  check("nish break opens the game", shell !== null && shell.answer("nish break") === shell.OPEN)
  check("nish break with more after it does not", shell !== null && shell.answer("nish break now") !== shell.OPEN)
  check("another nish command points at nish --help", /nish --help/.test(String(shell?.answer("nish build x.ts"))))
  check("another program points at nish --help", /^ls: .*nish --help/.test(String(shell?.answer("ls -la"))))
  check("an empty line answers nothing", shell?.answer("   ") === "")
}

{
  // site.js with the shell's source: the shell takes the terminal over.
  const source = await import(pathToFileURL(path.join(root, "examples", "break-web", "shell.mjs")).href)
  const opened = []
  const games = []
  let fail = true
  let hero = null
  const load = () => {
    games.push(fail)
    return fail
      ? Promise.reject(new Error("Failed to fetch dynamically imported module"))
      : Promise.resolve({ open: (how) => (opened.push(how), Promise.resolve()) })
  }
  hero = runSite(() =>
    Promise.resolve({
      attach: (term, input, lines, first) => source.attach(term, input, lines, first, { document: hero.document, load }),
    })
  )
  const input = hero.terminal.find("nish-hero__input")
  hero.terminal.dispatch("click", event("click"))
  enter(input, "nish game")
  typeIn(input, "l")
  await settle()
  // A browser blurs a focused element it moves: the input must stay where it is, focused, as keys keep coming.
  const focusKept = hero.document.activeElement === input
  typeFocused(hero.document, "s")
  check("the input keeps focus as the shell attaches, so the next key reaches the line",
    focusKept && input.value === "ls", `${hero.document.activeElement?.tag} ${input.value}`)
  input.value = "l"
  input.dispatch("input", event("input"))
  const said = () => hero.host.find("nish-hero__said")?.textContent
  check("a line entered while the shell loads is answered once it has", said() === `$ nish game\n${source.answer("nish game")}\n`, said())
  const typed = () => hero.host.find("nish-hero__caret")?.parent?.children.find((c) => c instanceof Node && c.tag === "span")?.textContent
  check("what was typed while it loaded stays on the line", typed() === "l" && input.value === "l", `${typed()} ${input.value}`)
  const form = hero.terminal.querySelector("form")
  check("the shell gives the input a form, by its form attribute, that autocompletes nothing",
    form?.parent === hero.terminal && form.id !== undefined && input.attributes.form === form.id && input.parent === hero.terminal &&
      form.attributes.autocomplete === "off", `${form?.id} ${input.attributes.form} ${JSON.stringify(form?.attributes)}`)
  check("the shell takes the input's events in place of site.js",
    input.listeners.get("input")?.length === 1 && input.listeners.get("keydown")?.length === 1, input.listeners.get("input")?.length)
  check("the terminal stays still for good once the shell has it", hero.terminal.className.includes("nish-hero__terminal--live"),
    hero.terminal.className)
  const drawn = hero.host.find("nish-hero__caret")?.parent
  check("a screen reader hears the answers, not the drawn copy of the line",
    hero.host.find("nish-hero__said")?.attributes["aria-live"] === "polite" && drawn?.attributes["aria-hidden"] === "true" &&
      hero.host.find("nish-hero__said")?.parent !== drawn)
  typeIn(input, "s")
  check("the line shows what is typed", typed() === "ls", typed())
  const ls = press(input, "Enter")
  check("the terminal prints the shell's answer and clears the line", said() === `$ ls\n${source.answer("ls")}\n` && input.value === "" &&
    typed() === "" && ls.prevented, said())
  const composing = press(input, "Enter", { isComposing: true })
  check("an Enter that ends a composition runs nothing", !composing.prevented)
  // A soft keyboard's go key that sends no Enter keydown submits the form.
  typeIn(input, "nish game")
  const submit = event("submit")
  form.dispatch("submit", submit)
  check("submitting the form (a go key with no Enter) runs the line and stays on the page",
    submit.prevented && said() === `$ nish game\n${source.answer("nish game")}\n` && input.value === "", said())
  typeIn(input, "x".repeat(50))
  check("the terminal takes a line of at most 40 characters", input.maxLength === 40 && input.value === "x".repeat(40) &&
    typed() === "x".repeat(40), input.value.length)
  press(input, "Enter")
  enter(input, "nish break")
  await settle()
  await settle()
  check("a failed import of the game says why in the terminal", /nish break: Failed to fetch/.test(said()), said())
  fail = false
  enter(input, "nish break")
  await settle()
  await settle()
  check("after a failed import the terminal takes the command again and retries", games.length === 2, games.length)
  check("the command opens the game with the input to return focus to", opened.length === 1 && opened[0].focus === input,
    opened.length)
  check("the terminal line clears once the game opens", said() === "", said())
  opened[0].say("boom")
  check("the game can say a line in the terminal", /\$ nish break\nboom/.test(said()), said())
  enter(input, "nish break")
  await settle()
  await settle()
  check("nish break again, once the game is shut, opens it again without a second import",
    opened.length === 2 && games.length === 2, `${opened.length} ${games.length}`)
  const ctrl = press(input, "r", { ctrlKey: true })
  const tab = press(input, "Tab")
  check("the shell leaves shortcuts and Tab alone", !ctrl.prevented && !tab.prevented)
  // Asked for from a tap, closing hands focus to nothing: refocusing the input would raise a soft keyboard.
  hero.terminal.dispatch("pointerdown", event("pointerdown", { pointerType: "touch" }))
  enter(input, "nish break")
  await settle()
  await settle()
  hero.terminal.dispatch("pointerdown", event("pointerdown", { pointerType: "mouse" }))
  enter(input, "nish break")
  await settle()
  await settle()
  check("the game opened from a tap returns focus nowhere; from a mouse or keys, to the input",
    opened.length === 4 && opened[2].focus === null && opened[3].focus === input, `${opened.length} ${opened[2]?.focus} ${opened[3]?.focus?.tag}`)
  // The last way in counts: a tap, then a hardware key, hands focus back; a soft keyboard's composing key (229) does not.
  // (A key typed in the input bubbles to the terminal; the fake DOM does not bubble, so the test sends both.)
  const keyed = (fields) => hero.terminal.dispatch("keydown", event("keydown", { target: input, ...fields }))
  hero.terminal.dispatch("pointerdown", event("pointerdown", { pointerType: "touch" }))
  keyed({ key: "n" })
  enter(input, "nish break")
  await settle()
  await settle()
  hero.terminal.dispatch("pointerdown", event("pointerdown", { pointerType: "touch" }))
  keyed({ key: "Unidentified", keyCode: 229 })
  enter(input, "nish break")
  await settle()
  await settle()
  check("after a tap, a hardware key makes closing return focus to the input, and a soft keyboard's key does not",
    opened.length === 6 && opened[4].focus === input && opened[5].focus === null, `${opened.length} ${opened[4]?.focus?.tag} ${opened[5]?.focus}`)
}

// --- break.mjs: the overlay ---------------------------------------------------

const page = await import(pathToFileURL(path.join(root, "examples", "break-web", "break.mjs")).href)

{
  const store = new Map()
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  check("no saved settings read as none", page.readSettings(storage) === null)
  store.set(page.STORE, "{not json")
  check("unreadable saved settings read as none", page.readSettings(storage) === null)
  store.set(page.STORE, "[1,2,3]")
  check("saved settings of the wrong length read as none", page.readSettings(storage) === null)
  page.writeSettings(storage, [0, 2, -1, 1, 1, 0, 1])
  check("settings round-trip through storage", JSON.stringify(page.readSettings(storage)) === "[0,2,-1,1,1,0,1]", store.get(page.STORE))
  // Each field one past its range, either way, and a fraction: another page on the origin may have written them.
  const outside = [
    [5, 0, 0, 0, 0, 0, 0],
    [-1, 0, 0, 0, 0, 0, 0],
    [0, 6, 0, 0, 0, 0, 0],
    [0, 0, -2, 0, 0, 0, 0],
    [0, 0, 4, 0, 0, 0, 0],
    [0, 0, 0, 2, 0, 0, 0],
    [0, 0, 0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, -1, 0],
    [0, 0, 0, 0, 0, 0, 2],
    [0.5, 0, 0, 0, 0, 0, 0],
  ].filter((words) => {
    store.set(page.STORE, JSON.stringify(words))
    return page.readSettings(storage) !== null
  })
  check("saved settings out of a field's range read as none", outside.length === 0, JSON.stringify(outside))
  const edges = [
    [4, 5, 3, 1, 1, 1, 1],
    [0, 0, -1, 0, 0, 0, 0],
  ].filter((words) => {
    store.set(page.STORE, JSON.stringify(words))
    return JSON.stringify(page.readSettings(storage)) !== JSON.stringify(words)
  })
  check("saved settings at each field's ends read back", edges.length === 0, JSON.stringify(edges))
  store.set(page.STORE, "[0,2,-1,1,1,0,1]")
  let threw = null
  try {
    page.writeSettings({ setItem: () => { throw new Error("quota") } }, [0, 0, 0, 0, 0, 0, 0])
  } catch (e) {
    threw = e
  }
  check("a storage that refuses a write is not an error", threw === null, threw)
  check("a storage that refuses a read reads as none", page.readSettings({ getItem: () => { throw new Error("denied") } }) === null)
}

{
  // A module that cannot be fetched: open rejects, and leaves the page as it was.
  const { document } = makeDocument()
  const focus = new Node("div")
  const said = []
  let error = null
  try {
    await page.open({
      focus,
      say: (t) => said.push(t),
      document,
      storage: null,
      wasm: new URL("file:///nowhere/game.wasm"),
      loader: { load: async () => ({}) },
    })
  } catch (e) {
    error = e
  }
  check("open rejects when the module cannot start", error !== null)
  check("a failed start removes the overlay", document.body.find("nish-break") === null)
  check("a failed start hands focus back", focus.focused === 1, focus.focused)
}

/**
 * Opens the overlay with a stand-in for startGame that resolves at once and
 * keeps what it was handed, so a test can quit the game through the loader
 * as the module would.
 */
const openFake = (document, extra = {}) => {
  const focus = new Node("input")
  const runs = []
  const started = page.open({
    focus,
    say: () => {},
    document,
    storage: null,
    wasm: new URL("file:///nowhere/game.wasm"),
    loader: { load: async () => fakeGame() },
    start: async (canvas, url, options) => {
      runs.push({ canvas, url, options })
    },
    ...extra,
  })
  return { focus, runs, started }
}
/** A module with BREAK_LINK whose next step quits. */
const fakeGame = () => {
  const link = new Int32Array(10)
  return {
    layout: { BREAK_LINK: 0 },
    views: () => ({ storage: { BREAK_LINK: link } }),
    step: () => (link[0] = 1),
  }
}
const overlays = (document) => [...document.body.all()].filter((n) => n.className === "nish-break")

{
  const { document } = makeDocument()
  const first = openFake(document)
  const second = openFake(document)
  check("a second open while one runs returns the first's promise, with one overlay",
    first.started === second.started && overlays(document).length === 1 && second.runs.length === 0, overlays(document).length)
  await first.started
  const [overlay] = overlays(document)
  const run = first.runs[0]
  check("the overlay is a modal dialog", overlay?.attributes.role === "dialog" && overlay?.attributes["aria-modal"] === "true",
    JSON.stringify(overlay?.attributes))
  const canvas = overlay.children.find((c) => c instanceof Node && c.tag === "canvas")
  const close = overlay.children.find((c) => c instanceof Node && c.tag === "button")
  check("once the game runs, its screen has focus", document.activeElement === canvas && close.focused === 1 && canvas.focused === 1,
    `${document.activeElement?.tag} ${close.focused} ${canvas.focused}`)
  const fromCanvas = press(overlay, "Tab", { target: canvas })
  const fromClose = press(overlay, "Tab", { target: close, shiftKey: true })
  check("Tab and Shift+Tab stay between the game and its close control",
    fromCanvas.prevented && fromClose.prevented && close.focused === 2 && canvas.focused === 2, `${close.focused} ${canvas.focused}`)
  // A renderer that falls back may put a fresh canvas in the first one's place.
  const swapped = new Node("canvas")
  canvas.remove()
  overlay.children.unshift(swapped)
  swapped.parent = overlay
  press(overlay, "Tab", { target: close })
  check("Tab from the close control reaches the canvas the game draws on now", swapped.focused === 1 && canvas.focused === 2,
    `${swapped.focused} ${canvas.focused}`)
  const escOnCanvas = press(overlay, "Escape", { target: swapped })
  check("Escape on the game's screen is the game's", !escOnCanvas.prevented && overlays(document).length === 1)
  const wheel = event("wheel")
  overlay.dispatch("wheel", wheel)
  const touch = event("touchmove")
  overlay.dispatch("touchmove", touch)
  check("a wheel or a drag over the game does not scroll the page", wheel.prevented && touch.prevented)
  // The module asks to quit: Escape on its title.
  const game = await run.options.loader.load(new Uint8Array(), {})
  game.step(0)
  check("quitting removes the overlay, stops the game and hands focus back",
    overlays(document).length === 0 && run.options.signal.aborted && first.focus.focused === 1,
    `${overlays(document).length} ${run.options.signal.aborted} ${first.focus.focused}`)
  const third = openFake(document)
  await third.started
  const thirdOverlay = overlays(document)[0]
  const escOnClose = press(thirdOverlay, "Escape", { target: thirdOverlay.children.find((c) => c instanceof Node && c.tag === "button") })
  check("Escape off the game's screen closes it and hands focus back",
    escOnClose.prevented && overlays(document).length === 0 && third.runs[0].options.signal.aborted && third.focus.focused === 1,
    `${overlays(document).length} ${third.focus.focused}`)
  const again = openFake(document)
  await again.started
  check("opening again after a quit starts a fresh game", again.started !== first.started && again.runs.length === 1 &&
    overlays(document).length === 1 && !again.runs[0].options.signal.aborted, overlays(document).length)
  const button = overlays(document)[0]?.children.find((c) => c instanceof Node && c.tag === "button")
  button?.dispatch("click", event("click"))
  check("the close control removes the overlay, stops the game and hands focus back",
    overlays(document).length === 0 && again.runs[0].options.signal.aborted && again.focus.focused === 1,
    `${overlays(document).length} ${again.focus.focused}`)
}

{
  // While the game loads, focus is in the overlay already: on its close control, where Escape closes.
  const { document } = makeDocument()
  let begin = null
  const loading = openFake(document, { start: () => new Promise((resolve) => (begin = resolve)) })
  const [overlay] = overlays(document)
  const close = overlay.children.find((c) => c instanceof Node && c.tag === "button")
  check("the overlay takes focus as it opens, on its close control until the game runs", document.activeElement === close,
    document.activeElement?.tag)
  const esc = press(overlay, "Escape", { target: document.activeElement })
  begin?.()
  await loading.started
  check("Escape while the game loads closes it and hands focus back",
    esc.prevented && overlays(document).length === 0 && loading.focus.focused === 1 && document.activeElement !== close,
    `${overlays(document).length} ${loading.focus.focused}`)
}

{
  // Reading localStorage can throw (storage blocked for the site): the game opens without saved settings.
  const { document } = makeDocument()
  const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => {
      throw new Error("SecurityError: the operation is insecure")
    },
  })
  let error = null
  try {
    const { started } = openFake(document, { storage: undefined })
    await started
  } catch (e) {
    error = e
  } finally {
    if (had === undefined) {
      delete globalThis.localStorage
    } else {
      Object.defineProperty(globalThis, "localStorage", had)
    }
  }
  check("a localStorage that throws when read does not stop the game opening", error === null, error)
  overlays(document)[0]?.children.find((c) => c instanceof Node && c.tag === "button")?.dispatch("click", event("click"))
}

// --- game.wasm: the built module plays as the terminal game does -------------
// The committed module, loaded through break.mjs's linkLoader as the page loads
// it, is driven with tests/link/break_core_wasm's script by writing key records
// into GAME_INPUT as nish/page/game does. With the resolution setting at 270
// lines both draw a 480x270 frame, so every checkpoint's hash must be the one
// that test prints: the page runs the same game, not a lookalike. That test's
// intro breaks apart a one-line stand-in help, handed in here through
// linkLoader; the page hands in none, and the compiler's --help (help.ts) is
// drawn instead.

const built = path.join(root, "docs", "site", "break")
/** FNV-1a over `game`'s frame size and pixels after a draw, as break_core_wasm hashes them. */
const hashFrame = (game) => {
  game.draw(1, 0)
  const s = game.views().storage
  const [w, h] = [s.GAME_INFO[0], s.GAME_INFO[1]]
  let x = 2166136261
  const mix = (v) => (x = Math.imul(x ^ v, 16777619) >>> 0)
  mix(w)
  mix(h)
  for (let i = 0; i < w * h; i++) {
    mix(s.GAME_FRAME[i] >>> 0)
  }
  return `${w}x${h} ${x}`
}
// break_core_wasm's help, as its main.ts spells it.
const standIn = JSON.parse(
  /const HELP: string = ("(?:[^"\\]|\\.)*")/.exec(
    fs.readFileSync(path.join(root, "tests", "link", "break_core_wasm", "main.ts"), "utf8")
  )?.[1] ?? "null"
)
{
  const { ringOver } = await import(pathToFileURL(path.join(built, "nish", "page.mjs")).href)
  const loader = await import(pathToFileURL(path.join(built, "game.mjs")).href)
  const { linkLoader } = await import(pathToFileURL(path.join(built, "break.mjs")).href)
  const reference = fs.readFileSync(path.join(root, "tests", "link", "break_core_wasm", "expected.out"), "utf8")
  const wanted = Object.fromEntries([...reference.matchAll(/^([\w ]+): scene \d+, (\d+x\d+), hash (\d+)$/gm)].map((m) => [m[1], `${m[2]} ${m[3]}`]))
  const saves = []
  let quits = 0
  // BreakSettings' defaults (src/break-menu.ts) but resolution 1, 270 lines, as break_core_wasm sets.
  const settings = [0, 1, -1, 1, 1, 0, 0]
  const game = await linkLoader(loader, settings, (w) => saves.push(w), () => quits++, standIn).load(
    fs.readFileSync(path.join(built, "game.wasm"))
  )
  game.init(11)
  const ring = ringOver(game.memory, game.layout.GAME_INPUT)
  // runtime/page-game.mjs's EVENT_KEY, ACTION_PRESS, ACTION_RELEASE and KEY_KINDS.
  const [PRESS, RELEASE] = [1, 3]
  const [DOWN, RIGHT, ENTER, SPACE, ESCAPE, F4] = [3, 4, 6, 7, 8, 17]
  const step = (events = []) => {
    for (const [kind, action] of events) {
      for (const word of [1, kind, 0, 0, action, 0, 0]) {
        ring.push(word)
      }
    }
    game.step(0)
  }
  const idle = (n) => {
    for (let i = 0; i < n; i++) {
      step()
    }
  }
  const tap = (kind) => {
    step([[kind, PRESS]])
    step([[kind, RELEASE]])
  }
  const frame = () => hashFrame(game)
  const seen = {}
  idle(40)
  seen.intro = frame()
  tap(F4)
  tap(SPACE)
  idle(30)
  seen.menu = frame()
  tap(ENTER)
  // break_core_wasm steps until the scene is the game; the menu's outro is 119 steps.
  idle(119)
  idle(60)
  seen.level = frame()
  step([[RIGHT, PRESS]])
  idle(20)
  step([[RIGHT, RELEASE]])
  seen["paddle right"] = frame()
  for (const name of ["intro", "menu", "level", "paddle right"]) {
    check(`the built module's ${name} frame is break_core_wasm's`, wanted[name] !== undefined && seen[name] === wanted[name],
      `${seen[name]} vs ${wanted[name]}`)
  }
  check("the built module synthesizes each of its 18 sounds and no more",
    [...Array(18).keys()].every((id) => game.sound(id) > 0) && game.sound(18) === 0)

  // A second run: Escape skips the intro to the title, as Space did; then
  // Settings, resolution one step right, out again, Escape on the title, and Quit.
  game.init(11)
  idle(40)
  tap(F4)
  tap(ESCAPE)
  idle(30)
  check("Escape in the intro opens the title, as any other key does", quits === 0 && frame() === seen.menu,
    `${quits} quits, ${frame()} vs ${seen.menu}`)
  for (const kind of [DOWN, DOWN, DOWN, ENTER, RIGHT, ESCAPE]) {
    tap(kind)
  }
  check("leaving Settings hands the changed settings to the page to keep",
    saves.length === 1 && JSON.stringify(saves[0]) === "[0,2,-1,1,1,0,0]", JSON.stringify(saves))
  check("the game has not quit while the player is still on the title", quits === 0, quits)
  tap(ESCAPE)
  idle(5)
  check("Escape on the title stays on the title", quits === 0, quits)
  // Leaving Settings left it selected; Quit is the next item down.
  tap(DOWN)
  tap(ENTER)
  idle(5)
  check("Quit on the title quits, and the page is told once", quits === 1, quits)
}

{
  // As the page loads it, with no help handed in: the intro breaks apart the compiler's --help.
  const loader = await import(pathToFileURL(path.join(built, "game.mjs")).href)
  const { linkLoader } = await import(pathToFileURL(path.join(built, "break.mjs")).href)
  const reference = fs.readFileSync(path.join(root, "tests", "link", "break_core_wasm", "expected.out"), "utf8")
  const wanted = /^intro: scene \d+, (\d+x\d+), hash (\d+)$/m.exec(reference)
  const game = await linkLoader(loader, [0, 1, -1, 1, 1, 0, 0], () => {}, () => {}).load(
    fs.readFileSync(path.join(built, "game.wasm"))
  )
  game.init(11)
  for (let i = 0; i < 40; i++) {
    game.step(0)
  }
  const intro = hashFrame(game)
  check("with no help handed in, the built module's intro draws the compiler's, not the stand-in",
    standIn !== null && wanted !== null && intro.startsWith(`${wanted[1]} `) && intro !== `${wanted[1]} ${wanted[2]}`,
    `${intro} vs ${wanted?.[1]} ${wanted?.[2]}`)
}

{
  // The help handed in: UTF-8 bytes, one a word of BREAK_HELP_IN after its length.
  const loader = await import(pathToFileURL(path.join(built, "game.mjs")).href)
  const { linkLoader } = await import(pathToFileURL(path.join(built, "break.mjs")).href)
  const wasm = fs.readFileSync(path.join(built, "game.wasm"))
  const helpTs = fs.readFileSync(path.join(root, "examples", "break-web", "help.ts"), "utf8")
  const gameHelp = JSON.parse(/export const BREAK_HELP: string =\n  ("(?:[^"\\]|\\.)*")\n/.exec(helpTs)?.[1] ?? "null")
  /** Loads the module with `help` handed in; its intro's hash, and the words it was handed. */
  const withHelp = async (help) => {
    const game = await linkLoader(loader, [0, 1, -1, 1, 1, 0, 0], () => {}, () => {}, help).load(wasm)
    const words = Array.from(game.views().storage.BREAK_HELP_IN)
    game.init(11)
    for (let i = 0; i < 40; i++) {
      game.step(0)
    }
    return { intro: hashFrame(game), words }
  }
  const none = await withHelp(null)
  const own = await withHelp(gameHelp)
  check("the compiler's help handed in, ▀ and all, draws the intro the module draws with none",
    typeof gameHelp === "string" && /[^\x00-\x7f]/.test(gameHelp) && own.words[0] === Buffer.byteLength(gameHelp) &&
      own.intro === none.intro, `${own.intro} vs ${none.intro}`)
  const empty = await withHelp("")
  check("an empty help hands in nothing: the intro is the compiler's", empty.words[0] === 0 && empty.intro === none.intro,
    `${empty.intro} vs ${none.intro}`)
  const capacity = none.words.length
  const last = `${"a".repeat(capacity - 2)}b`
  const fits = await withHelp(last)
  check("the longest help that fits is handed in to its last byte, and drawn in place of the compiler's",
    capacity > Buffer.byteLength(gameHelp) && fits.words[0] === capacity - 1 && fits.words[capacity - 1] === 98 &&
      fits.intro !== none.intro, `${capacity} ${fits.words[0]}`)
  let threw = null
  try {
    await withHelp("a".repeat(capacity))
  } catch (e) {
    threw = e
  }
  check("a help one byte longer than fits is refused", threw instanceof RangeError, threw)
  const wide = await withHelp("\u{1F600} nish\n")
  check("a help past the BMP is handed in as its UTF-8 bytes and drawn",
    JSON.stringify(wide.words.slice(0, 11)) === JSON.stringify([10, 0xf0, 0x9f, 0x98, 0x80, ...Buffer.from(" nish\n")]) &&
      wide.intro !== none.intro, JSON.stringify(wide.words.slice(0, 11)))
  let missing = null
  try {
    await linkLoader({ load: async () => fakeGame() }, null, () => {}, () => {}, "help").load(new Uint8Array())
  } catch (e) {
    missing = e
  }
  check("a help for a module with no BREAK_HELP_IN is refused", missing instanceof TypeError, missing)
}

// --- build.mjs --check: a stale or incomplete build is refused ----------------

{
  const build = path.join(root, "examples", "break-web", "build.mjs")
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "break-web-check-"))
  fs.cpSync(built, copy, { recursive: true })
  const manifestFile = path.join(copy, "manifest.json")
  const committed = fs.readFileSync(manifestFile, "utf8")
  const verify = (...extra) => spawnSync(process.execPath, [build, "--check", "--out", copy, "--nish", nish, ...extra], { encoding: "utf8" })
  const edited = (edit) => {
    const m = JSON.parse(committed)
    edit(m)
    fs.writeFileSync(manifestFile, JSON.stringify(m))
  }
  const ok = verify()
  check("--check passes on the committed build", ok.status === 0 && /is up to date/.test(ok.stdout), ok.stderr)
  edited((m) => (m.inputs["src/break-director.ts"] = "0".repeat(64)))
  const stale = verify()
  check("--check names an input changed since the build", stale.status === 1 && /stale[\s\S]*src\/break-director\.ts/.test(stale.stderr),
    stale.stderr)
  edited((m) => (m.help = "0".repeat(64)))
  const help = verify()
  check("--check fails once the compiler's --help drifts from the page's", help.status === 1 && /--help/.test(help.stderr), help.stderr)
  fs.writeFileSync(manifestFile, committed)
  const agent = spawnSync(process.execPath, [build, "--check", "--out", copy, "--nish", nish], {
    encoding: "utf8",
    env: { ...process.env, CLAUDECODE: "1", NISH_AGENT: "1", FORCE_COLOR: "1" },
  })
  check("--check asks the compiler as a person would, whoever runs it", agent.status === 0, agent.stderr)
  const loaderFile = path.join(copy, "game.mjs")
  const loader = fs.readFileSync(loaderFile)
  fs.appendFileSync(loaderFile, "\n// edited\n")
  const tampered = verify()
  check("--check fails on a served file changed since the build",
    tampered.status === 1 && /game\.mjs \(not the file this build wrote\)/.test(tampered.stderr), tampered.stderr)
  fs.writeFileSync(loaderFile, loader)
  const shellCopy = path.join(copy, "shell.mjs")
  const shellText = fs.readFileSync(shellCopy, "utf8")
  fs.writeFileSync(shellCopy, shellText.replace(/export const VERSION = "[^"]*"/, 'export const VERSION = "nish 0.0.0"'))
  edited((m) => (m.outputs["shell.mjs"] = createHash("sha256").update(fs.readFileSync(shellCopy)).digest("hex")))
  const answers = verify()
  check("--check fails on a shell whose --version is not the compiler's, even with its hash recorded",
    answers.status === 1 && /shell\.mjs \(its --help or --version is not the compiler's\)/.test(answers.stderr), answers.stderr)
  fs.writeFileSync(shellCopy, shellText)
  fs.writeFileSync(manifestFile, committed)
  const memory = verify("--memory", "64")
  check("--check fails on another --memory", memory.status === 1 && /--memory \(32 → 64\)/.test(memory.stderr), memory.stderr)
  const extra = path.join(copy, "nish", "stray.mjs")
  fs.writeFileSync(extra, "")
  const stray = verify()
  check("--check fails on a file in the build it does not write", stray.status === 1 &&
    /nish\/stray\.mjs \(not a file this build writes\)/.test(stray.stderr), stray.stderr)
  fs.rmSync(extra)
  fs.appendFileSync(loaderFile, `\n// ${root}\n`)
  edited((m) => (m.outputs["game.mjs"] = createHash("sha256").update(fs.readFileSync(loaderFile)).digest("hex")))
  const leak = verify()
  check("--check fails on a served module that names a path of the machine that built it, even with its hash recorded",
    leak.status === 1 && /game\.mjs \(names /.test(leak.stderr), leak.stderr)
  fs.writeFileSync(loaderFile, loader)
  // Another machine's paths, which --check here cannot know: a macOS home in the loader, a Windows drive in the shell.
  fs.appendFileSync(loaderFile, "\n// /Users/builder/nish/src\n")
  fs.appendFileSync(shellCopy, "\n// D:\\builder\\nish\n")
  edited((m) => {
    m.outputs["game.mjs"] = createHash("sha256").update(fs.readFileSync(loaderFile)).digest("hex")
    m.outputs["shell.mjs"] = createHash("sha256").update(fs.readFileSync(shellCopy)).digest("hex")
  })
  const elsewhere = verify()
  check("--check fails on a served file that names a path of any machine, a builder's home or a Windows drive",
    elsewhere.status === 1 && /game\.mjs \(names \/Users\/\)/.test(elsewhere.stderr) &&
      /shell\.mjs \(names D:\\\)/.test(elsewhere.stderr), elsewhere.stderr)
  fs.writeFileSync(loaderFile, loader)
  fs.writeFileSync(shellCopy, shellText)
  fs.writeFileSync(manifestFile, committed)
  fs.rmSync(path.join(copy, "shell.mjs"))
  const missing = verify()
  check("--check fails on a built file gone missing", missing.status === 1 && /shell\.mjs \(missing from the build\)/.test(missing.stderr),
    missing.stderr)
  fs.rmSync(manifestFile)
  const none = verify()
  check("--check fails with no manifest", none.status === 1 && /manifest\.json is missing/.test(none.stderr), none.stderr)
  fs.rmSync(copy, { recursive: true })
}

console.log(results.join("\n"))
console.log(`checks: ${results.length}`)
