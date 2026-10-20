#!/usr/bin/env node
// The crypto twins: every family under bench/crypto/ (a directory with a
// family.json) builds one program per language, the same kernels over the
// same inputs, and this runner checks that every program prints the same
// checksum and times them against each other. See bench/crypto/README.md for
// the program contract and the family.json schema.
//
//   node bench/crypto/run.mjs [options]
//     --validate        build every variant, run each kernel once at its small
//                       size and compare every checksum with the family's
//                       expected.txt; nothing is timed. A family with a
//                       portableProof also proves its portable columns are
//                       portable (README.md, "portableProof").
//                       Exit 1 on any mismatch
//     --write-expected  with --validate: rewrite each family's expected.txt from
//                       the checksums, once every variant agrees
//     --only a,b        family names (hash) or kernel names (sha256) to run
//     --rounds N        timed rounds (default 11); the median is reported
//     --out <file>      also write the section to <file>
//     --record          splice the section into docs/BENCHMARKS.md between
//                       <!-- crypto:begin --> and <!-- crypto:end -->
//     --no-openssl, --no-go, --no-rust, --no-node
//                       leave that twin out; its cells read —
//     --compiler <nish> the compiler under test (default build/nish)
//
// Columns: nish, nish-copy (a byte-identical copy of the Nish binary, timed in
// the same rounds: the noise band), openssl and openssl-portable (one binary,
// the second run under the family's OPENSSL_ia32cap mask), go and go-purego
// (`-tags purego`), rust and rust-soft (the family's rustflags, in a target
// directory of its own), node. A missing toolchain is a note and a column of
// —, never a failure; a twin that builds and prints a different checksum is.
//
// Timing: each case (kernel and size) calibrates one iteration count on its
// first column so a run takes about 200 ms, and every column runs that count.
// Each round runs every column once, the order rotated by one per round; the
// table reports the median of each column's own `ns` lines. Nish is compared
// with the fastest portable twin and the fastest assembly twin, and each
// quotient is read against the noise band (bench/par-reading.mjs's sideOf).
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { sideOf, times3 } from "../par-reading.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const libDir = path.join(here, "lib")
const outRoot = path.join(root, "build", "bench", "crypto")
if (process.argv.includes("-h") || process.argv.includes("--help")) {
  const banner = fs
    .readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n")
    .slice(1)
  const end = banner.findIndex((l) => !l.startsWith("//"))
  console.log(
    banner
      .slice(0, end)
      .map((l) => l.replace(/^\/\/ ?/, ""))
      .join("\n")
  )
  process.exit(0)
}
const nishc = compilerFrom(process.argv)
const CC = process.env.CC ?? "clang"
/** The go command: `GO=<path>` overrides the one on PATH, as in bench/run.mjs. */
const GO = process.env.GO || "go"

/** The iterations every --validate run takes; expected.txt records them. */
const VALIDATE_ITERATIONS = 3
/** How long a timed run aims to take, in nanoseconds. */
const TARGET_NS = 200e6
/** The portable proof's default: a portable column at least this much slower than its twin's default one. */
const PORTABLE_MIN_RATIO = 1.2
const TWINS = ["openssl", "go", "rust", "node"]
const TWIN_LABELS = { openssl: "OpenSSL", go: "Go", rust: "Rust", node: "Node" }
const PORTABLE_IDS = { openssl: "openssl-portable", go: "go-purego", rust: "rust-soft" }
const COLUMNS = [
  ["nish", "Nish"],
  ["openssl", "OpenSSL"],
  ["openssl-portable", "OpenSSL portable"],
  ["go", "Go"],
  ["go-purego", "Go purego"],
  ["rust", "Rust"],
  ["rust-soft", "Rust soft"],
  ["node", "Node"],
]

const fail = (message) => {
  console.error(`crypto: ${message}`)
  process.exit(2)
}

// ---- Options ---------------------------------------------------------------------

const opts = {
  validate: false,
  writeExpected: false,
  only: null,
  rounds: 11,
  out: null,
  record: false,
  skip: new Set(),
}
for (let i = 2; i < nishc.rest.length; i++) {
  const a = nishc.rest[i]
  const next = () => {
    const v = nishc.rest[++i]
    if (v === undefined) {
      fail(`${a} needs a value`)
    }
    return v
  }
  if (a === "--validate") {
    opts.validate = true
  } else if (a === "--write-expected") {
    opts.writeExpected = true
  } else if (a === "--only") {
    opts.only = new Set(next().split(",").filter(Boolean))
  } else if (a === "--rounds") {
    opts.rounds = Number(next())
    if (!Number.isInteger(opts.rounds) || opts.rounds < 1) {
      fail("--rounds expects a positive integer")
    }
  } else if (a === "--out") {
    opts.out = path.resolve(next())
  } else if (a === "--record") {
    opts.record = true
  } else if (a.startsWith("--no-") && TWINS.includes(a.slice(5))) {
    opts.skip.add(a.slice(5))
  } else {
    fail(`unknown option ${a}`)
  }
}
if (opts.writeExpected && !opts.validate) {
  fail("--write-expected belongs to --validate")
}
if (opts.validate && (opts.record || opts.out !== null)) {
  fail("--validate times nothing, so it has no section to --record or --out")
}

// ---- Families --------------------------------------------------------------------

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v)
const isStringMap = (v) => isObject(v) && Object.values(v).every((x) => typeof x === "string")
const isStringList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string")

/** Refuses a key `allowed` does not name, so a misspelt field is an error rather than a default. */
const onlyKeys = (where, value, allowed) => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(`${where}: unknown field \`${key}\` (allowed: ${allowed.join(", ")})`)
    }
  }
}

/** One family.json, checked against the schema in bench/crypto/README.md. */
const loadFamily = (name) => {
  const dir = path.join(here, name)
  const where = `bench/crypto/${name}/family.json`
  let spec
  try {
    spec = JSON.parse(fs.readFileSync(path.join(dir, "family.json"), "utf8"))
  } catch (e) {
    fail(`${where}: ${e.message}`)
  }
  if (!isObject(spec)) {
    fail(`${where}: not an object`)
  }
  onlyKeys(where, spec, ["title", "kernels", "twins", "portableProof", "portableMinRatio", "needs"])
  if (typeof spec.title !== "string") {
    fail(`${where}: \`title\` must be a string`)
  }
  if (!Array.isArray(spec.kernels) || spec.kernels.length === 0) {
    fail(`${where}: \`kernels\` must be a non-empty array`)
  }
  const kernels = spec.kernels.map((k, i) => {
    const at = `${where}: kernels[${i}]`
    if (!isObject(k)) {
      fail(`${at}: not an object`)
    }
    onlyKeys(at, k, ["name", "sizes", "unit", "nish", "validateSize"])
    if (typeof k.name !== "string" || !/^[a-z0-9-]+$/.test(k.name)) {
      fail(`${at}: \`name\` must be lower-case letters, digits and dashes`)
    }
    const sizes = k.sizes
    if (!Array.isArray(sizes) || sizes.length === 0 || !sizes.every((s) => Number.isInteger(s) && s >= 4)) {
      fail(`${at}: \`sizes\` must be a non-empty array of integers of at least 4`)
    }
    if (k.unit !== "MB/s" && k.unit !== "op/s") {
      fail(`${at}: \`unit\` must be "MB/s" or "op/s"`)
    }
    if (k.nish !== undefined && typeof k.nish !== "boolean") {
      fail(`${at}: \`nish\` must be a boolean`)
    }
    const validateSize = k.validateSize ?? Math.min(...sizes)
    if (!Number.isInteger(validateSize) || validateSize < 4) {
      fail(`${at}: \`validateSize\` must be an integer of at least 4`)
    }
    return { name: k.name, sizes, unit: k.unit, nish: k.nish ?? true, validateSize }
  })
  const names = new Set(kernels.map((k) => k.name))
  if (names.size !== kernels.length) {
    fail(`${where}: two kernels share a name`)
  }
  if (!isObject(spec.twins)) {
    fail(`${where}: \`twins\` must be an object`)
  }
  onlyKeys(`${where}: twins`, spec.twins, TWINS)
  const twins = {}
  for (const twin of TWINS) {
    const t = spec.twins[twin]
    const at = `${where}: twins.${twin}`
    if (typeof t === "string") {
      twins[twin] = { absent: t }
      continue
    }
    if (!isObject(t)) {
      fail(`${at}: an object, or a string saying why the family has no ${TWIN_LABELS[twin]} twin`)
    }
    onlyKeys(at, t, ["env", "portable", "lacks"])
    if (t.env !== undefined && !isStringMap(t.env)) {
      fail(`${at}.env: an object of strings`)
    }
    if (t.lacks !== undefined && !(isStringMap(t.lacks) && Object.keys(t.lacks).every((k) => names.has(k)))) {
      fail(`${at}.lacks: an object from this family's kernel names to the reason the twin lacks each`)
    }
    let portable = t.portable
    if (twin === "node" && typeof portable !== "string") {
      fail(`${at}.portable: Node has no portable build, so a string saying why`)
    }
    if (typeof portable === "string") {
      portable = { absent: portable }
    } else if (isObject(portable)) {
      const fields = { openssl: ["env"], go: ["tags", "env"], rust: ["rustflags", "env"] }[twin]
      onlyKeys(`${at}.portable`, portable, fields)
      if (portable.env !== undefined && !isStringMap(portable.env)) {
        fail(`${at}.portable.env: an object of strings`)
      }
      if (portable.tags !== undefined && !isStringList(portable.tags)) {
        fail(`${at}.portable.tags: an array of strings`)
      }
      if (portable.rustflags !== undefined && !isStringList(portable.rustflags)) {
        fail(`${at}.portable.rustflags: an array of strings`)
      }
      if (Object.keys(portable).length === 0) {
        fail(`${at}.portable: names what makes the build portable, or is a string saying why there is none`)
      }
    } else {
      fail(`${at}.portable: an object, or a string saying why the twin has no portable column`)
    }
    twins[twin] = { env: t.env ?? {}, portable, lacks: t.lacks ?? {} }
  }
  let proof = null
  if (spec.portableProof !== undefined) {
    const m = /^([a-z0-9-]+)@(\d+)$/.exec(String(spec.portableProof))
    if (m === null || !names.has(m[1])) {
      fail(`${where}: \`portableProof\` must be "<kernel>@<size>" naming one of its kernels`)
    }
    proof = { kernel: m[1], size: Number(m[2]) }
  }
  // One number for every portable column, or one per twin.
  const ratioSpec = spec.portableMinRatio ?? PORTABLE_MIN_RATIO
  const above1 = (x) => typeof x === "number" && x > 1
  if (isObject(ratioSpec)) {
    onlyKeys(`${where}: portableMinRatio`, ratioSpec, Object.keys(PORTABLE_IDS))
  }
  if (
    !(
      above1(ratioSpec) ||
      (isObject(ratioSpec) && Object.values(ratioSpec).every((x) => x === null || above1(x)))
    )
  ) {
    fail(
      `${where}: \`portableMinRatio\` must be a number above 1, or an object from twin to such a number or null`
    )
  }
  const minRatio = Object.fromEntries(
    Object.keys(PORTABLE_IDS).map((t) => {
      if (!isObject(ratioSpec)) {
        return [t, ratioSpec]
      }
      return [t, t in ratioSpec ? ratioSpec[t] : PORTABLE_MIN_RATIO]
    })
  )
  if (spec.portableMinRatio !== undefined && proof === null) {
    fail(`${where}: \`portableMinRatio\` without a \`portableProof\``)
  }
  const needs = spec.needs ?? []
  if (!(isStringList(needs) && needs.every((n) => n === "loopback"))) {
    fail(`${where}: \`needs\` is an array whose only allowed entry is "loopback"`)
  }
  if (kernels.some((k) => k.nish) && !fs.existsSync(path.join(dir, "main.ts"))) {
    fail(`bench/crypto/${name}: a kernel with \`nish\` true needs main.ts`)
  }
  return { name, dir, title: spec.title, kernels, twins, proof, minRatio, needs }
}

/** `<kernel> <size> <iterations> <checksum>` per line of a family's expected.txt; `#` lines are comments. */
const readExpected = (family) => {
  const file = path.join(family.dir, "expected.txt")
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : []
  const expected = new Map()
  for (const line of lines) {
    if (line.trim() === "" || line.startsWith("#")) {
      continue
    }
    const m = /^([a-z0-9-]+) (\d+) (\d+) ([0-9a-f]{8})$/.exec(line)
    if (m === null) {
      fail(
        `bench/crypto/${family.name}/expected.txt: \`${line}\` is not "<kernel> <size> <iterations> <checksum>"`
      )
    }
    expected.set(`${m[1]} ${m[2]} ${m[3]}`, m[4])
  }
  return expected
}

const familyNames = fs
  .readdirSync(here, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(here, e.name, "family.json")))
  .map((e) => e.name)
  .sort()
const families = familyNames.map(loadFamily)
if (opts.only) {
  for (const name of opts.only) {
    if (!families.some((f) => f.name === name || f.kernels.some((k) => k.name === name))) {
      fail(`--only: no family or kernel \`${name}\``)
    }
  }
}
const wanted = (family, kernel) => !opts.only || opts.only.has(family.name) || opts.only.has(kernel.name)

// ---- Toolchains ------------------------------------------------------------------

/** The first line a command prints, or null when it cannot run. */
const versionOf = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" })
  return r.error === undefined && r.status === 0 ? `${r.stdout}${r.stderr}`.split("\n")[0].trim() : null
}

const notes = []
const note = (text) => {
  notes.push(text)
  console.error(`note: ${text}`)
}

/** A step that must work: a twin that does not build is a broken bench. */
const build = (what, cmd, args, { cwd = root, env = process.env } = {}) => {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" })
  if (r.error !== undefined || r.status !== 0) {
    console.error(`crypto: building ${what} failed (exit ${r.status})\n${r.error?.message ?? ""}${r.stderr}`)
    process.exit(1)
  }
}

const probeDir = path.join(outRoot, "probe")
/** Whether clang links a program against OpenSSL's libcrypto and libssl, headers included. */
const opensslLinks = () => {
  fs.mkdirSync(probeDir, { recursive: true })
  const src = path.join(probeDir, "openssl.c")
  fs.writeFileSync(src, "#include <openssl/evp.h>\n#include <openssl/ssl.h>\nint main(void) { return 0; }\n")
  const r = spawnSync(CC, [src, "-o", path.join(probeDir, "openssl"), "-lssl", "-lcrypto"], {
    encoding: "utf8",
  })
  return r.error === undefined && r.status === 0
}

const tools = {
  nish: versionOf(nishc.cmd, [...nishc.prefix, "--version"]),
  cc: versionOf(CC, ["--version"]),
  openssl: null,
  go: opts.skip.has("go") ? null : versionOf(GO, ["version"]),
  rustc: opts.skip.has("rust") ? null : versionOf("rustc", ["--version"]),
  cargo: opts.skip.has("rust") ? null : versionOf("cargo", ["--version"]),
  node: opts.skip.has("node") ? null : process.version,
}
if (tools.nish === null) {
  fail(`${nishc.cmd} --version did not run`)
}
if (!opts.skip.has("openssl") && tools.cc !== null && opensslLinks()) {
  tools.openssl = versionOf("openssl", ["version"]) ?? "OpenSSL (version unknown: no openssl command)"
}
/** Why a twin has no column on this machine when its toolchain is absent. */
const absent = {
  openssl: tools.openssl === null ? `${CC} could not link against OpenSSL's headers and libraries` : null,
  go: tools.go === null ? "no go toolchain" : null,
  rust: tools.cargo === null ? "no cargo" : null,
  node: null,
}
/** Why a twin has no column on this machine, or null when it has one. */
const missing = Object.fromEntries(TWINS.map((t) => [t, opts.skip.has(t) ? `--no-${t}` : absent[t]]))
for (const twin of TWINS) {
  if (missing[twin] !== null && !opts.skip.has(twin)) {
    note(`${TWIN_LABELS[twin]}: ${missing[twin]}; its columns read —`)
  }
}

/** Whether this machine lets a program listen on and connect to 127.0.0.1, which a handshake family may need. */
const loopbackWorks = () =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once("error", () => resolve(false))
    server.listen(0, "127.0.0.1", () => server.close(() => resolve(true)))
  })
const loopback = families.some((f) => f.needs.includes("loopback")) ? await loopbackWorks() : true

// ---- Builds ----------------------------------------------------------------------

/** Copies `from`'s files (not its subdirectories) into `to`, renaming by `rename`. */
const copyFiles = (from, to, rename = {}) => {
  fs.mkdirSync(to, { recursive: true })
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.isFile()) {
      fs.copyFileSync(path.join(from, e.name), path.join(to, rename[e.name] ?? e.name))
    }
  }
}

/**
 * Builds a family's programs into build/bench/crypto/<family>/ and returns
 * its variants, one per column it can fill: `{ id, twin, portable, cmd, args, env }`.
 */
const buildFamily = (family) => {
  const dir = path.join(outRoot, family.name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const variants = []
  const add = (id, twin, portable, cmd, args, env = {}) =>
    variants.push({ id, twin, portable, cmd, args, env: { ...process.env, ...env } })

  if (family.kernels.some((k) => k.nish)) {
    const exe = path.join(dir, "nish", "main")
    fs.mkdirSync(path.dirname(exe), { recursive: true })
    build(`${family.name} (Nish)`, nishc.cmd, [
      ...nishc.prefix,
      path.join(family.dir, "main.ts"),
      "-o",
      `${path.dirname(exe)}${path.sep}`,
      "--link",
      exe,
      "--profile",
      "speed",
    ])
    // The noise band: the same bytes under another name, timed in the same rounds.
    fs.copyFileSync(exe, `${exe}-copy`)
    add("nish", null, false, exe, [])
    add("nish-copy", null, false, `${exe}-copy`, [])
  }
  const twinUsable = (twin) => {
    const t = family.twins[twin]
    return t.absent === undefined && missing[twin] === null
  }
  const portableEnv = (t) => ({ ...t.env, ...(t.portable.env ?? {}) })

  if (twinUsable("openssl")) {
    const t = family.twins.openssl
    const exe = path.join(dir, "openssl", "main")
    fs.mkdirSync(path.dirname(exe), { recursive: true })
    build(`${family.name} (OpenSSL)`, CC, [
      "-O3",
      "-I",
      libDir,
      path.join(family.dir, "openssl.c"),
      "-o",
      exe,
      "-lssl",
      "-lcrypto",
    ])
    add("openssl", "openssl", false, exe, [], t.env)
    if (t.portable.absent === undefined) {
      add("openssl-portable", "openssl", true, exe, [], portableEnv(t))
    }
  }
  if (twinUsable("go")) {
    const t = family.twins.go
    const src = path.join(dir, "go")
    copyFiles(path.join(family.dir, "go"), src)
    fs.copyFileSync(path.join(libDir, "gen.go"), path.join(src, "gen.go"))
    // No toolchain download and no workspace from above: the module as committed.
    const env = { ...process.env, GOTOOLCHAIN: "local", GOWORK: "off", GOFLAGS: "-mod=readonly", ...t.env }
    const fetched = spawnSync(GO, ["mod", "download"], { cwd: src, env, encoding: "utf8" })
    if (fetched.status !== 0) {
      note(`Go: ${family.name}'s modules did not download; its Go columns read —`)
    } else {
      build(`${family.name} (Go)`, GO, ["build", "-trimpath", "-o", path.join(dir, "go-main"), "."], {
        cwd: src,
        env,
      })
      add("go", "go", false, path.join(dir, "go-main"), [], t.env)
      if (t.portable.absent === undefined) {
        const tags = t.portable.tags ?? []
        const args = ["build", "-trimpath", ...(tags.length > 0 ? ["-tags", tags.join(",")] : [])]
        build(`${family.name} (Go portable)`, GO, [...args, "-o", path.join(dir, "go-portable"), "."], {
          cwd: src,
          env: { ...env, ...(t.portable.env ?? {}) },
        })
        add("go-purego", "go", true, path.join(dir, "go-portable"), [], portableEnv(t))
      }
    }
  }
  if (twinUsable("rust")) {
    const t = family.twins.rust
    const crate = path.join(dir, "rust")
    // Cargo reads only Cargo.toml and Cargo.lock, names the repository's kebab-case rule refuses.
    copyFiles(path.join(family.dir, "rust"), crate, {
      "cargo.toml": "Cargo.toml",
      "cargo.lock": "Cargo.lock",
    })
    copyFiles(path.join(family.dir, "rust", "src"), path.join(crate, "src"))
    fs.copyFileSync(path.join(libDir, "gen.rs"), path.join(crate, "src", "gen.rs"))
    const bin = /^name\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(crate, "Cargo.toml"), "utf8"))?.[1]
    const env = { ...process.env, ...t.env }
    const fetched = spawnSync("cargo", ["fetch", "--locked", "--quiet"], {
      cwd: crate,
      env,
      encoding: "utf8",
    })
    if (fetched.status !== 0) {
      note(
        `Rust: ${family.name}'s crates did not fetch (${fetched.stderr.trim().split("\n").pop()}); its Rust columns read —`
      )
    } else {
      const cargo = (what, target, extra) =>
        build(what, "cargo", ["build", "--release", "--locked", "--quiet", "--target-dir", target], {
          cwd: crate,
          env: { ...env, ...extra },
        })
      cargo(`${family.name} (Rust)`, path.join(crate, "target"), {})
      add("rust", "rust", false, path.join(crate, "target", "release", bin), [], t.env)
      if (t.portable.absent === undefined) {
        // One flag per element, spaces and quotes kept, and a target directory
        // of its own so the two builds never share an artifact.
        const flags = { CARGO_ENCODED_RUSTFLAGS: (t.portable.rustflags ?? []).join("\x1f") }
        cargo(`${family.name} (Rust portable)`, path.join(crate, "target-soft"), {
          ...flags,
          ...(t.portable.env ?? {}),
        })
        add("rust-soft", "rust", true, path.join(crate, "target-soft", "release", bin), [], portableEnv(t))
      }
    }
  }
  if (twinUsable("node")) {
    add("node", "node", false, process.execPath, [path.join(family.dir, "node.mjs")], family.twins.node.env)
  }
  return variants
}

// ---- Running ---------------------------------------------------------------------

/** One run under the contract: `{ checksum, ns }`, or `{ error }` saying what broke it. */
const runOnce = (variant, kernel, size, iterations) => {
  const r = spawnSync(variant.cmd, [...variant.args, kernel, String(size), String(iterations)], {
    encoding: "utf8",
    env: variant.env,
    maxBuffer: 1 << 20,
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    const why = r.error?.message ?? `exit ${r.status}`
    return { error: `${why}\nstdout: ${r.stdout ?? ""}\nstderr: ${r.stderr ?? ""}` }
  }
  return { checksum: sum[1], ns: Number(ns[1]) }
}

/** The variants that implement `kernel`: Nish only where the kernel says so, a twin unless it lacks it. */
const runnersOf = (family, kernel, variants) =>
  variants.filter((v) =>
    v.twin === null ? kernel.nish : family.twins[v.twin].lacks[kernel.name] === undefined
  )

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** An iteration count that makes `variant` take about `target` ns on `kernel` at `size`. */
const calibrate = (variant, kernel, size, target) => {
  let iterations = 1
  for (;;) {
    const r = runOnce(variant, kernel, size, iterations)
    if (r.error !== undefined) {
      console.error(`crypto: ${variant.id} ${kernel} ${size} failed while calibrating: ${r.error}`)
      process.exit(1)
    }
    if (r.ns >= target / 10 || iterations >= 1 << 30) {
      return Math.max(1, Math.round((iterations * target) / Math.max(r.ns, 1)))
    }
    iterations *= Math.min(100, Math.max(2, Math.ceil(target / 10 / Math.max(r.ns, 1))))
  }
}

/** Every variant once per round, the order rotated by one each round; `{ id: [ns, …] }` and the checksums seen. */
const interleave = (variants, kernel, size, iterations, rounds) => {
  const times = new Map(variants.map((v) => [v.id, []]))
  const sums = new Map()
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < variants.length; i++) {
      const v = variants[(i + round) % variants.length]
      const r = runOnce(v, kernel, size, iterations)
      if (r.error !== undefined) {
        console.error(`crypto: ${v.id} ${kernel} ${size} failed: ${r.error}`)
        process.exit(1)
      }
      times.get(v.id).push(r.ns)
      sums.set(v.id, r.checksum)
    }
  }
  return { times, sums }
}

// ---- --validate ------------------------------------------------------------------

if (opts.validate) {
  let mismatches = 0
  let kernelCount = 0
  const seen = new Set()
  for (const family of families) {
    if (!family.kernels.some((k) => wanted(family, k))) {
      continue
    }
    if (family.needs.includes("loopback") && !loopback) {
      note(`${family.name}: needs a loopback socket and 127.0.0.1 refused one; not validated`)
      continue
    }
    const variants = buildFamily(family)
    const expected = readExpected(family)
    const written = []
    let matched = 0
    for (const kernel of family.kernels.filter((k) => wanted(family, k))) {
      const key = `${kernel.name} ${kernel.validateSize} ${VALIDATE_ITERATIONS}`
      const want = expected.get(key)
      const runners = runnersOf(family, kernel, variants)
      const sums = new Map()
      for (const v of runners) {
        const r = runOnce(v, kernel.name, kernel.validateSize, VALIDATE_ITERATIONS)
        if (r.error !== undefined) {
          console.log(`FAILED ${kernel.name} ${v.id}: ${r.error}`)
          mismatches++
          continue
        }
        sums.set(v.id, r.checksum)
        seen.add(v.id)
      }
      const distinct = new Set(sums.values())
      if (opts.writeExpected) {
        if (distinct.size !== 1) {
          console.log(
            `CHECKSUM MISMATCH ${kernel.name}: ${[...sums].map(([id, s]) => `${id} ${s}`).join(", ")}`
          )
          mismatches++
        } else {
          written.push(`${key} ${[...distinct][0]}`)
        }
      } else if (want === undefined) {
        console.log(
          `CHECKSUM MISMATCH ${kernel.name}: bench/crypto/${family.name}/expected.txt has no \`${key}\` line`
        )
        mismatches++
      } else {
        for (const [id, sum] of sums) {
          if (sum !== want) {
            console.log(`CHECKSUM MISMATCH ${kernel.name} ${id}: printed ${sum}, expected.txt has ${want}`)
            mismatches++
          }
        }
        if ([...sums.values()].every((s) => s === want) && sums.size === runners.length) {
          matched++
        }
      }
      if (sums.size === 0) {
        console.log(`CHECKSUM MISMATCH ${kernel.name}: no variant ran`)
        mismatches++
      }
      kernelCount++
    }
    if (opts.writeExpected && mismatches === 0) {
      const head =
        "# <kernel> <size> <iterations> <checksum>, written by `node bench/crypto/run.mjs --validate --write-expected`.\n"
      fs.writeFileSync(path.join(family.dir, "expected.txt"), `${head}${written.join("\n")}\n`)
      console.log(`${family.name}: wrote expected.txt (${written.length} line(s))`)
    } else if (!opts.writeExpected) {
      console.log(`${family.name}: ${matched} kernel(s) match expected.txt`)
    }
    // The portable proof: each portable column must be measurably slower than
    // its twin's default one, so the mask, tag or flag really took the
    // assembly away. A twin whose ratio is null is measured and reported only.
    if (family.proof !== null && (!opts.only || opts.only.has(family.name))) {
      const { kernel, size } = family.proof
      for (const twin of Object.keys(PORTABLE_IDS)) {
        const fast = variants.find((v) => v.id === twin)
        const slow = variants.find((v) => v.id === PORTABLE_IDS[twin])
        if (fast === undefined || slow === undefined || family.twins[twin].lacks[kernel] !== undefined) {
          continue
        }
        const need = family.minRatio[twin]
        // A portable column with a binary of its own must be other bytes: the
        // tag or flag reached the compiler. This part is exact; the time is not.
        if (slow.cmd !== fast.cmd && fs.readFileSync(slow.cmd).equals(fs.readFileSync(fast.cmd))) {
          console.log(`NOT PORTABLE ${family.name} ${slow.id}: the same bytes as ${fast.id}`)
          mismatches++
          continue
        }
        // The fastest round of each: a shared machine's noise only ever adds time.
        // A short ratio is measured once more, longer, before it counts.
        const measure = (rounds) => {
          const iterations = calibrate(fast, kernel, size, TARGET_NS / 2)
          const { times } = interleave([fast, slow], kernel, size, iterations, rounds)
          return Math.min(...times.get(slow.id)) / Math.min(...times.get(fast.id))
        }
        let ratio = measure(5)
        if (need === null) {
          console.log(
            `portable ${family.name} ${slow.id}: other bytes than ${fast.id}; ${times3(ratio)} its time at ${kernel}@${size} (reported, not gated)`
          )
          continue
        }
        if (ratio < need) {
          console.log(`retry ${family.name} ${slow.id}: ${times3(ratio)} on the first measurement`)
          ratio = measure(11)
        }
        const verdict = ratio >= need ? "portable" : "NOT PORTABLE"
        console.log(
          `${verdict} ${family.name} ${slow.id}: ${times3(ratio)} the time of ${fast.id} at ${kernel}@${size} (needs ${times3(need)})`
        )
        if (ratio < need) {
          mismatches++
        }
      }
    }
  }
  if (mismatches > 0) {
    console.log(`crypto: ${mismatches} mismatch(es); nothing is timed`)
    process.exit(1)
  }
  if (!opts.writeExpected) {
    console.log(`crypto: checksums agree over ${kernelCount} kernel(s) and ${seen.size} variant(s)`)
  }
  process.exit(0)
}

// ---- Timing ----------------------------------------------------------------------

/** Throughput from a median: MB/s (10^6 bytes) over the message bytes, or operations a second. */
const rateOf = (unit, size, iterations, ns) =>
  unit === "MB/s" ? (size * iterations * 1e3) / ns : (iterations * 1e9) / ns
const fmtRate = (x) => (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toPrecision(3))
const fmtSize = (n) => {
  if (n >= 1 << 20 && n % (1 << 20) === 0) {
    return `${n >> 20} MiB`
  }
  return n >= 1024 && n % 1024 === 0 ? `${n >> 10} KiB` : `${n} B`
}

const sections = []
let mismatches = 0
for (const family of families) {
  const kernels = family.kernels.filter((k) => wanted(family, k))
  if (kernels.length === 0) {
    continue
  }
  if (family.needs.includes("loopback") && !loopback) {
    note(`${family.name}: needs a loopback socket and 127.0.0.1 refused one; not timed`)
    continue
  }
  const variants = buildFamily(family)
  const rows = []
  for (const kernel of kernels) {
    const runners = runnersOf(family, kernel, variants)
    for (const size of kernel.sizes) {
      const iterations = calibrate(runners[0], kernel.name, size, TARGET_NS)
      const { times, sums } = interleave(runners, kernel.name, size, iterations, opts.rounds)
      const sum = sums.get(runners[0].id)
      for (const [id, s] of sums) {
        if (s !== sum) {
          console.error(
            `CHECKSUM MISMATCH ${kernel.name} ${id}: printed ${s}, ${runners[0].id} printed ${sum}`
          )
          mismatches++
        }
      }
      const medians = new Map([...times].map(([id, ns]) => [id, median(ns)]))
      rows.push({ kernel, size, iterations, medians })
      console.error(
        `${family.name} ${kernel.name} ${size}: ${[...medians].map(([id, ns]) => `${id} ${fmtRate(rateOf(kernel.unit, size, iterations, ns))}`).join(", ")}`
      )
    }
  }
  sections.push({ family, variants, rows })
}
if (mismatches > 0) {
  console.error(
    `crypto: ${mismatches} checksum mismatch(es); the table is not trustworthy and nothing is written`
  )
  process.exit(1)
}

/** The CPU's name and the flags a crypto kernel's speed turns on, from /proc/cpuinfo. */
const machine = () => {
  let text = ""
  try {
    text = fs.readFileSync("/proc/cpuinfo", "utf8")
  } catch {
    // Not Linux: os.cpus() names the CPU and the flags are unknown.
  }
  const model = /^model name\s*:\s*(.+)$/m.exec(text)?.[1].trim() ?? os.cpus()[0]?.model ?? "unknown CPU"
  const flags = new Set((/^flags\s*:\s*(.+)$/m.exec(text)?.[1] ?? "").split(/\s+/))
  const listed = ["aes", "pclmulqdq", "sha_ni", "avx2", "avx512f"]
  const shown =
    flags.size > 1 ? listed.map((f) => `${f} ${flags.has(f) ? "yes" : "no"}`).join(", ") : "unknown"
  return `${model} (${os.arch()}, ${os.cpus().length} CPUs); flags: ${shown}`
}

/** A quotient read against the noise band: `1.23x slower (rust-soft)`, or the band's word when within it. */
const verdict = (row, ids) => {
  const have = ids.filter((id) => row.medians.has(id))
  if (!row.medians.has("nish") || have.length === 0) {
    return "—"
  }
  const best = have.reduce((a, b) => (row.medians.get(b) < row.medians.get(a) ? b : a))
  const band = Math.abs(row.medians.get("nish") / row.medians.get("nish-copy") - 1)
  const quotient = row.medians.get("nish") / row.medians.get(best)
  const side = sideOf(quotient, band)
  return `${times3(quotient)} ${side === "within" ? "within the band" : side} (${best})`
}

const ASM_IDS = ["openssl", "go", "rust", "node"]
const PORTABLE_COLUMN_IDS = Object.values(PORTABLE_IDS)
const lines = [
  "<!-- crypto:begin -->",
  "## Crypto against other languages",
  "",
  "Written by `node bench/crypto/run.mjs --record`, not by `bench/run.mjs`, which carries this section over when it rewrites the file. The programs, the inputs and the measurement rules are in [bench/crypto/README.md](../bench/crypto/README.md).",
  "",
  "Each cell is the median of the column's own timed loop over the rounds, every column at one iteration count per row, the order rotated each round. The last two columns divide Nish's median time by the fastest portable twin's (no assembly: OpenSSL under an `OPENSSL_ia32cap` mask, Go `-tags purego`, RustCrypto's soft backend) and by the fastest default twin's (assembly and CPU extensions allowed); above 1.000x Nish is slower. A quotient within the noise band, the gap between Nish and a byte-identical copy of its binary, is no difference.",
  "",
  `Machine: ${machine()}.`,
  "",
  `Toolchains: Nish ${tools.nish.replace(/^nish /, "")}; ${tools.cc?.replace(/\s*\(.*$/, "") ?? "no C compiler"}${tools.openssl ? `, ${tools.openssl}` : ""}; ${tools.go ?? "no Go"}; ${tools.rustc ?? "no Rust"}; Node ${tools.node ?? "—"}. ${opts.rounds} round(s).`,
  "",
]
for (const { family, variants, rows } of sections) {
  const ids = new Set(variants.map((v) => v.id))
  lines.push(`### ${family.title} (\`bench/crypto/${family.name}\`)`, "")
  lines.push(
    `| Kernel | Size | Unit | ${COLUMNS.map(([, l]) => l).join(" | ")} | Nish / best portable | Nish / best assembly |`,
    `| --- | --- | --- | ${COLUMNS.map(() => "---:").join(" | ")} | --- | --- |`
  )
  for (const row of rows) {
    const cell = (id) => {
      const ns = row.medians.get(id)
      return ns === undefined ? "—" : fmtRate(rateOf(row.kernel.unit, row.size, row.iterations, ns))
    }
    lines.push(
      `| ${row.kernel.name} | ${fmtSize(row.size)} | ${row.kernel.unit} | ${COLUMNS.map(([id]) => cell(id)).join(" | ")} | ${verdict(row, PORTABLE_COLUMN_IDS)} | ${verdict(row, ASM_IDS)} |`
    )
  }
  const bands = rows
    .filter((r) => r.medians.has("nish-copy"))
    .map((r) => Math.abs(r.medians.get("nish") / r.medians.get("nish-copy") - 1))
  lines.push("")
  if (bands.length > 0) {
    lines.push(
      `Noise band, Nish against its byte-identical copy: ${(Math.min(...bands) * 100).toFixed(1)}% to ${(Math.max(...bands) * 100).toFixed(1)}% across the rows.`,
      ""
    )
  }
  // Every — in the table says why.
  const why = []
  for (const twin of TWINS) {
    const t = family.twins[twin]
    if (t.absent !== undefined) {
      why.push(`${TWIN_LABELS[twin]}: ${t.absent}`)
      continue
    }
    if (!ids.has(twin)) {
      why.push(`${TWIN_LABELS[twin]}: not on this machine (${missing[twin] ?? "see the run's notes"})`)
    }
    for (const [kernel, reason] of Object.entries(t.lacks)) {
      why.push(`${TWIN_LABELS[twin]} has no ${kernel}: ${reason}`)
    }
    if (t.portable?.absent !== undefined) {
      why.push(`${TWIN_LABELS[twin]} has no portable column: ${t.portable.absent}`)
    }
  }
  for (const kernel of family.kernels.filter((k) => !k.nish)) {
    why.push(`${kernel.name} has no Nish column: the family marks it twins-only`)
  }
  for (const w of why) {
    lines.push(`- ${w}`)
  }
  lines.push("")
}
for (const n of notes) {
  lines.push(`Note: ${n}`, "")
}
lines.push("<!-- crypto:end -->")
const section = lines.join("\n")

console.log(section)
if (opts.out !== null) {
  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  fs.writeFileSync(opts.out, `${section}\n`)
  console.error(`wrote ${path.relative(root, opts.out)}`)
}
if (opts.record) {
  const file = path.join(root, "docs", "BENCHMARKS.md")
  const text = fs.readFileSync(file, "utf8")
  const begin = "<!-- crypto:begin -->"
  const end = "<!-- crypto:end -->"
  const from = text.indexOf(begin)
  const to = text.indexOf(end)
  const next =
    from >= 0 && to > from
      ? `${text.slice(0, from)}${section}${text.slice(to + end.length)}`
      : `${text.trimEnd()}\n\n${section}\n`
  fs.writeFileSync(file, next)
  console.error(`recorded in ${path.relative(root, file)}`)
}
