// Checks the docs hero terminal (docs/site/site.js and its shell), and the page side of the game
// (examples/break-web/break.mjs) under Node, with a small fake DOM; then plays
// the built docs/site/break/game.wasm against break_core_wasm's frames and
// runs build.mjs --check on a copy of the build. Prints one
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

/**
 * Runs site.js in a fresh fake document. Its `import(...)` goes to
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
    site.replace(/\bimport\(/g, "load(")
  )
  run(document, window, class { observe() {} }, () => {}, Node, load)
  return { document, host, terminal: host.find("nish-hero__terminal") }
}
const keydown = (key, mods = {}) => {
  const event = { key, ctrlKey: false, metaKey: false, altKey: false, prevented: false, ...mods }
  event.preventDefault = () => (event.prevented = true)
  return event
}

{
  // A shell that cannot be fetched.
  const asked = []
  const hero = runSite((specifier) => {
    asked.push(specifier)
    return Promise.reject(new Error("Failed to fetch dynamically imported module"))
  })
  check("site.js builds a focusable hero terminal", hero.terminal?.attributes.tabindex === "0", hero.host.textContent)
  check("site.js imports nothing before the terminal's first key", asked.length === 0, asked.join(", "))
  const ctrl = keydown("r", { ctrlKey: true })
  hero.terminal.dispatch("keydown", ctrl)
  const tab = keydown("Tab")
  hero.terminal.dispatch("keydown", tab)
  check("the terminal leaves shortcuts and Tab alone, and imports nothing for them", !ctrl.prevented && !tab.prevented && asked.length === 0,
    asked.join(", "))
  const first = press(hero.terminal, "l")
  press(hero.terminal, "s")
  check("the first key asks for the shell once, and nothing else", first.prevented && asked.join(", ") === "/break/shell.mjs",
    asked.join(", "))
  await settle()
  press(hero.terminal, "l")
  check("a key after a failed import asks for the shell again", asked.length === 2, asked.join(", "))
}

{
  // A shell that loads: site.js hands it the terminal, the keys typed while it
  // loaded, and its own listener to take down.
  const attached = []
  const hero = runSite(() => Promise.resolve({ attach: (...args) => attached.push(args) }))
  type(hero.terminal, "ls")
  await settle()
  check(
    "the loaded shell gets the terminal and every key typed while it loaded",
    attached.length === 1 && attached[0][0] === hero.terminal && attached[0][1].join(",") === "l,s,Enter" &&
      hero.terminal.listeners.get("keydown")?.includes(attached[0][2]),
    JSON.stringify(attached.map((a) => a[1]))
  )
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
    Promise.resolve({ attach: (term, keys, first) => source.attach(term, keys, first, { document: hero.document, load }) })
  )
  type(hero.terminal, "nish game")
  await settle()
  const said = () => hero.host.find("nish-hero__said")?.textContent
  check("keys typed while the shell loads are answered once it has", said() === `$ nish game\n${source.answer("nish game")}\n`, said())
  check("the shell takes the terminal's keys in place of site.js", hero.terminal.listeners.get("keydown")?.length === 1,
    hero.terminal.listeners.get("keydown")?.length)
  type(hero.terminal, "ls")
  check("the terminal prints the shell's answer", said() === `$ ls\n${source.answer("ls")}\n`, said())
  type(hero.terminal, "x".repeat(50))
  check("the terminal takes a line of at most 40 characters", said() === `$ ${"x".repeat(40)}\n${source.answer("x".repeat(40))}\n`, said())
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("a failed import of the game says why in the terminal", /nish break: Failed to fetch/.test(said()), said())
  fail = false
  type(hero.terminal, "nish break")
  await settle()
  await settle()
  check("after a failed import the terminal takes the command again and retries", games.length === 2, games.length)
  check("the command opens the game with the terminal to return focus to", opened.length === 1 && opened[0].focus === hero.terminal,
    opened.length)
  check("the terminal line clears once the game opens", said() === "", said())
  opened[0].say("boom")
  check("the game can say a line in the terminal", /\$ nish break\nboom/.test(said()), said())
  const ctrl = keydown("r", { ctrlKey: true })
  hero.terminal.dispatch("keydown", ctrl)
  const tab = keydown("Tab")
  hero.terminal.dispatch("keydown", tab)
  check("the shell leaves shortcuts and Tab alone", !ctrl.prevented && !tab.prevented)
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

// --- game.wasm: the built module plays as the terminal game does -------------
// The committed module, loaded through break.mjs's linkLoader as the page loads
// it, is driven with tests/link/break_core_wasm's script by writing key records
// into GAME_INPUT as nish/page/game does. With the resolution setting at 270
// lines both draw a 480x270 frame, so every checkpoint's hash must be the one
// that test prints: the page runs the same game, not a lookalike.

const built = path.join(root, "docs", "site", "break")
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
  const game = await linkLoader(loader, settings, (w) => saves.push(w), () => quits++).load(
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
  /** Draws, then FNV-1a over the frame's size and pixels, as break_core_wasm hashes them. */
  const frame = () => {
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

  // A second run: Settings, resolution one step right, out again, then Escape on the title.
  game.init(11)
  idle(40)
  tap(SPACE)
  idle(30)
  for (const kind of [DOWN, DOWN, DOWN, ENTER, RIGHT, ESCAPE]) {
    tap(kind)
  }
  check("leaving Settings hands the changed settings to the page to keep",
    saves.length === 1 && JSON.stringify(saves[0]) === "[0,2,-1,1,1,0,0]", JSON.stringify(saves))
  check("the game has not quit while the player is still on the title", quits === 0, quits)
  tap(ESCAPE)
  idle(5)
  check("Escape on the title quits, and the page is told once", quits === 1, quits)
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
  const memory = verify("--memory", "64")
  check("--check fails on another --memory", memory.status === 1 && /--memory \(32 → 64\)/.test(memory.stderr), memory.stderr)
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
