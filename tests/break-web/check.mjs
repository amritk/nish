// Checks the docs hero terminal's game trigger and the page side of the game
// (examples/break-web/break.mjs) under Node, with a small fake DOM. Prints one
// `ok <name>` or `not ok <name>\t<detail>` line per check, then `checks: <n>`;
// the `break-web` section of tests/run.js turns each line into a check and
// compares the count, so a run cut short is caught.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import zlib from "node:zlib"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
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

// --- site.js: the trigger costs the page one dynamic import ------------------

const siteFile = path.join(root, "docs", "site", "site.js")
const site = fs.readFileSync(siteFile, "utf8")
const imports = [...site.matchAll(/\bimport\b\s*(\(|[^(\s])/g)]
check(
  "site.js reaches the game only through one dynamic import of /break/break.mjs",
  imports.length === 1 && imports[0][1] === "(" && /\bconst url = "\/break\/break\.mjs"\s+opening \?\?= import\(url\)/.test(site),
  imports.map((m) => m[0]).join(", ")
)

// The hero's script ships on every docs page: the trigger may add under 1 KB
// to it, gzipped. The baseline is site.js as it was before the trigger.
const SITE_GZIP_BEFORE = 3200
const gzipped = zlib.gzipSync(site, { level: 9 }).length
check(
  "site.js grows by under 1 KB gzipped",
  gzipped - SITE_GZIP_BEFORE < 1024,
  `${gzipped} B gzipped, ${SITE_GZIP_BEFORE} B before`
)

/**
 * Runs site.js in a fresh fake document. Its one `import(...)` goes to
 * `load(specifier)`, so a test decides what the import does.
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
    site.replace(/\bimport\(/, "load(")
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
  type(hero.terminal, "ls")
  check("an unknown command is not found, and imports nothing", /ls: command not found/.test(hero.said.textContent) && asked.length === 0,
    hero.said.textContent)
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("a failed import says why in the terminal", /nish break: Failed to fetch/.test(hero.said.textContent), hero.said.textContent)
  check("the failed import asked for /break/break.mjs once", asked.length === 1 && asked[0] === "/break/break.mjs", asked.join(", "))
  // The hero is still usable: it takes the next command, and retries the import.
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("after a failed import the terminal takes the command again and retries", asked.length === 2, asked.join(", "))
  const typed = press(hero.terminal, "x")
  check("after a failed import the terminal still takes keys", typed.prevented && /\$ x/.test(hero.terminal.textContent),
    hero.terminal.textContent)
}

{
  const opened = []
  const hero = runSite(() => Promise.resolve({ open: (how) => (opened.push(how), Promise.resolve()) }))
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
