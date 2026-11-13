// Checks the docs hero terminal's game trigger and the page side of the game
// (examples/break-web/break.mjs) under Node, with a small fake DOM. Prints one
// `ok <name>` or `not ok <name>\t<detail>` line per check, then `checks: <n>`;
// the `break-web` section of tests/run.js turns each line into a check and
// compares the count, so a run cut short is caught.

import { spawnSync } from "node:child_process"
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
        child.parent = this
      }
      this.children.push(child)
    }
  }
  remove() {
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
  find(className) {
    return [...this.all()].find((n) => n.className.split(" ").includes(className)) ?? null
  }
}

const makeDocument = () => {
  const body = new Node("body")
  const host = new Node("div")
  body.append(host)
  const document = {
    body,
    readyState: "complete",
    createElement: (tag) => new Node(tag),
    createElementNS: (_ns, tag) => new Node(tag),
    querySelectorAll: () => (host.children.length === 0 ? [host] : []),
    addEventListener: () => {},
  }
  return { document, host }
}

/** A keydown on `node`, with what the handler reads. */
const press = (node, key) => {
  const event = { key, ctrlKey: false, metaKey: false, altKey: false, prevented: false }
  event.preventDefault = () => (event.prevented = true)
  node.dispatch("keydown", event)
  return event
}
const type = (node, line) => {
  for (const key of line) {
    press(node, key)
  }
  press(node, "Enter")
}

// --- site.js: the terminal costs the page two dynamic imports ----------------

const siteFile = path.join(root, "docs", "site", "site.js")
const site = fs.readFileSync(siteFile, "utf8")
const imports = [...site.matchAll(/\bimport\b\s*(\(|[^(\s])/g)]
check(
  "site.js reaches the shell and the game only through two dynamic imports of /break/",
  imports.length === 2 &&
    imports.every((m) => m[1] === "(") &&
    /\bconst url = "\/break\/break\.mjs"\s+opening \?\?= import\(url\)/.test(site) &&
    /\bconst shellUrl = "\/break\/shell\.mjs"\s+shell \?\?= import\(shellUrl\)/.test(site),
  imports.map((m) => m[0]).join(", ")
)
// Nothing else reaches /break/ before it is asked for: no preload, no module
// worker, no fetch of the bundle, and no word of its .wasm.
check(
  "site.js names /break/ nowhere but those imports",
  !/\.wasm\b|modulepreload|\bpreload\b|\bprefetch\b|\bfetch\(|\bWorker\(/.test(site) && site.split(/["'`]\/break\//).length === 3,
  "site.js mentions .wasm, a preload, a fetch or a worker, or quotes a /break/ path a third time"
)

// The hero's script ships on every docs page: the terminal may add under 1 KB
// to it, gzipped. The baseline is site.js on main without the terminal's
// imports (71c41439).
const SITE_GZIP_BEFORE = 3480
const gzipped = zlib.gzipSync(site, { level: 9 }).length
check(
  "site.js grows by under 1 KB gzipped",
  gzipped - SITE_GZIP_BEFORE < 1024,
  `${gzipped} B gzipped, ${SITE_GZIP_BEFORE} B before`
)

/**
 * Runs site.js in a fresh fake document. Its `import(...)`s go to
 * `load(specifier)`, so a test decides what each import does.
 */
const runSite = (load) => {
  const { document, host } = makeDocument()
  const window = {}
  const run = new Function(
    "document",
    "window",
    "MutationObserver",
    "requestAnimationFrame",
    "Element",
    "load",
    site.replace(/\bimport\(/g, "load(")
  )
  run(document, window, class { observe() {} }, () => {}, Node, load)
  return { document, host, terminal: host.find("nish-hero__terminal"), said: host.find("nish-hero__said") }
}

{
  const asked = []
  const hero = runSite((specifier) => {
    asked.push(specifier)
    return Promise.reject(new Error("Failed to fetch dynamically imported module"))
  })
  check("site.js builds a focusable hero terminal", hero.terminal?.attributes.tabindex === "0", hero.host.textContent)
  check("site.js imports nothing before the terminal's first key", asked.length === 0, asked.join(", "))
  type(hero.terminal, "ls")
  await settle()
  check("without its shell the terminal finds no command", /ls: command not found/.test(hero.said.textContent), hero.said.textContent)
  check("the first key asks for the shell, and nothing else", asked.join(", ") === "/break/shell.mjs", asked.join(", "))
  type(hero.terminal, "ls")
  check("a shell that failed to load is not asked for again", asked.length === 1, asked.join(", "))
  const games = () => asked.filter((s) => s === "/break/break.mjs").length
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("a failed import says why in the terminal", /nish break: Failed to fetch/.test(hero.said.textContent), hero.said.textContent)
  check("without its shell the terminal still opens the game", games() === 1, asked.join(", "))
  // The hero is still usable: it takes the next command, and retries the import.
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("after a failed import the terminal takes the command again and retries", games() === 2, asked.join(", "))
  const typed = press(hero.terminal, "x")
  check("after a failed import the terminal still takes keys", typed.prevented && /\$ x/.test(hero.terminal.textContent),
    hero.terminal.textContent)
}

{
  const opened = []
  const hero = runSite((specifier) =>
    specifier === "/break/break.mjs"
      ? Promise.resolve({ open: (how) => (opened.push(how), Promise.resolve()) })
      : Promise.reject(new Error("offline"))
  )
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("the command opens the game with the terminal to return focus to", opened.length === 1 && opened[0].focus === hero.terminal,
    opened.length)
  check("the terminal line clears once the game opens", hero.said.textContent === "", hero.said.textContent)
  opened[0].say("boom")
  check("the game can say a line in the terminal", /\$ nish break\nboom/.test(hero.said.textContent), hero.said.textContent)
  const ctrl = { key: "r", ctrlKey: true, metaKey: false, altKey: false, prevented: false, preventDefault() { this.prevented = true } }
  hero.terminal.dispatch("keydown", ctrl)
  check("the terminal leaves the browser's shortcuts alone", !ctrl.prevented)
}

// --- shell.mjs: what the terminal answers ------------------------------------

// The served shell, as build.mjs fills it in from the compiler.
const shellFile = path.join(root, "docs", "site", "break", "shell.mjs")
const shell = fs.existsSync(shellFile) ? await import(pathToFileURL(shellFile).href) : null
check("docs/site/break/shell.mjs is built", shell !== null, shellFile)
const asks = (args, cwd) => spawnSync(nish, args, { cwd, encoding: "utf8" })
{
  const help = asks(["--help"])
  check("the shell's nish --help is the compiler's", shell?.answer("nish --help") === help.stdout.replace(/\n$/, "") && help.status === 0,
    `${help.status}: ${help.stdout.slice(0, 80)}`)
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
  // The terminal with its shell: it prints the shell's answers, and opens the game on OPEN.
  const opened = []
  const hero = runSite((specifier) =>
    specifier === "/break/shell.mjs" && shell !== null
      ? Promise.resolve(shell)
      : Promise.resolve({ open: (how) => (opened.push(how), Promise.resolve()) })
  )
  press(hero.terminal, "n")
  press(hero.terminal, "Backspace")
  await settle()
  type(hero.terminal, "nish game")
  check("the terminal prints the shell's answer", hero.said.textContent === `$ nish game\n${shell?.answer("nish game")}\n`,
    hero.said.textContent)
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("the terminal opens the game on the shell's word", opened.length === 1, opened.length)
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
  page.writeSettings({ setItem: () => { throw new Error("quota") } }, [0, 0, 0, 0, 0, 0, 0])
  check("a storage that refuses a write is not an error", true)
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

console.log(results.join("\n"))
console.log(`checks: ${results.length}`)
