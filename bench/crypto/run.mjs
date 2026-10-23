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
//                       <!-- crypto:begin --> and <!-- crypto:end -->; the
//                       whole table, so not with --only or --no-<twin>
//     --no-openssl, --no-go, --no-rust, --no-node
//                       leave that twin out; its cells read —
//     --compiler <nish> the compiler under test (default build/nish)
//     --families <dir>  read the families from <dir> rather than bench/crypto/:
//                       tests/run.js validates altered copies this way
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
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"
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
/** A run that takes longer than this has hung, or calibrated to something absurd. */
const RUN_TIMEOUT_MS = 120e3
/** The portable proof's default: a portable column at least this much slower than its twin's default one. */
const PORTABLE_MIN_RATIO = 1.2
/**
 * The paired-rounds proof (README.md, "portableRounds"): how many rounds, and
 * the chance it may give a portable column that changed nothing a pass.
 */
const PAIRED_ROUNDS = 48
const PAIRED_ALPHA = 0.001
const TWINS = ["openssl", "go", "rust", "node"]
const TWIN_LABELS = { openssl: "OpenSSL", go: "Go", rust: "Rust", node: "Node" }
const PORTABLE_IDS = { openssl: "openssl-portable", go: "go-purego", rust: "rust-soft" }

/**
 * The /proc/cpuinfo flag each OPENSSL_ia32cap bit stands for, per word. The
 * first word is CPUID(1) EDX in its low half and ECX in its high half; the
 * second is CPUID(7) EBX, then ECX.
 */
const IA32CAP_FLAGS = [
  { 33: "pclmulqdq", 41: "ssse3", 44: "fma", 51: "sse4_1", 52: "sse4_2", 54: "movbe", 57: "aes", 60: "avx" },
  {
    3: "bmi1",
    5: "avx2",
    8: "bmi2",
    16: "avx512f",
    19: "adx",
    29: "sha_ni",
    30: "avx512bw",
    31: "avx512vl",
    41: "vaes",
    42: "vpclmulqdq",
  },
]

/**
 * The cpuinfo flags an OPENSSL_ia32cap value takes away: a `~x` word clears
 * x's bits, a bare word keeps only its own, and an absent word clears nothing.
 */
const ia32capCleared = (value) => {
  const cleared = []
  value.split(":").forEach((word, i) => {
    const m = /^(~?)(0x[0-9a-f]+|\d+)$/i.exec(word.trim())
    if (m === null || IA32CAP_FLAGS[i] === undefined) {
      return
    }
    const bits = BigInt(m[2])
    for (const [bit, flag] of Object.entries(IA32CAP_FLAGS[i])) {
      const set = ((bits >> BigInt(bit)) & 1n) === 1n
      if (m[1] === "~" ? set : !set) {
        cleared.push(flag)
      }
    }
  })
  return cleared
}
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
  families: here,
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
  } else if (a === "--families") {
    opts.families = path.resolve(next())
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
// docs/BENCHMARKS.md's section is the whole table: a part of it, or one with
// a twin left out, goes to --out.
if (opts.record && (opts.only !== null || opts.skip.size > 0 || opts.families !== here)) {
  fail(
    "--record writes the whole table, so it takes no --only, --no-<twin> or --families; use --out for a part"
  )
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
  const dir = path.join(opts.families, name)
  const where = path.relative(root, path.join(dir, "family.json"))
  let spec
  try {
    spec = JSON.parse(fs.readFileSync(path.join(dir, "family.json"), "utf8"))
  } catch (e) {
    fail(`${where}: ${e.message}`)
  }
  if (!isObject(spec)) {
    fail(`${where}: not an object`)
  }
  onlyKeys(where, spec, [
    "title",
    "kernels",
    "twins",
    "portableProof",
    "portableMinRatio",
    "portableProofFlags",
    "portableRounds",
    "needs",
    "notes",
  ])
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
    // A kernel without a Nish column says why, and the table's footnote prints it.
    if (k.nish !== undefined && k.nish !== true && !(typeof k.nish === "string" && k.nish !== "")) {
      fail(`${at}: \`nish\` is true, or a string saying why the kernel has no Nish column`)
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
    const kernelMap = (v) => v === undefined || (isStringMap(v) && Object.keys(v).every((k) => names.has(k)))
    if (!kernelMap(t.lacks)) {
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
      onlyKeys(`${at}.portable`, portable, [...fields, "lacks"])
      if (!kernelMap(portable.lacks)) {
        fail(
          `${at}.portable.lacks: an object from this family's kernel names to the reason the portable build lacks each`
        )
      }
      if (portable.env !== undefined && !isStringMap(portable.env)) {
        fail(`${at}.portable.env: an object of strings`)
      }
      if (portable.tags !== undefined && !isStringList(portable.tags)) {
        fail(`${at}.portable.tags: an array of strings`)
      }
      if (portable.rustflags !== undefined && !isStringList(portable.rustflags)) {
        fail(`${at}.portable.rustflags: an array of strings`)
      }
      if (fields.every((f) => portable[f] === undefined)) {
        fail(`${at}.portable: names what makes the build portable, or is a string saying why there is none`)
      }
      // OpenSSL's portable column runs the default binary, so its env is all
      // that makes it portable, and only the time ratio can prove it.
      if (twin === "openssl" && Object.keys(portable.env ?? {}).length === 0) {
        fail(
          `${at}.portable.env: OpenSSL's portable column is the same binary, so its env must mask something`
        )
      }
    } else {
      fail(`${at}.portable: an object, or a string saying why the twin has no portable column`)
    }
    twins[twin] = {
      env: t.env ?? {},
      portable: { ...portable, lacks: portable.lacks ?? {} },
      lacks: t.lacks ?? {},
    }
  }
  // One case, or a list of them tried in order: a twin is proved by the first
  // case whose ratio reaches its minimum.
  let proof = null
  if (spec.portableProof !== undefined) {
    const cases = Array.isArray(spec.portableProof) ? spec.portableProof : [spec.portableProof]
    if (cases.length === 0 || new Set(cases.map(String)).size !== cases.length) {
      fail(`${where}: \`portableProof\` must be one "<kernel>@<size>", or a non-empty list of distinct ones`)
    }
    proof = cases.map((c) => {
      const m = /^([a-z0-9-]+)@(\d+)$/.exec(String(c))
      if (m === null || !names.has(m[1])) {
        fail(`${where}: \`portableProof\` must be "<kernel>@<size>" naming one of its kernels`)
      }
      const at = { kernel: m[1], size: Number(m[2]) }
      if (!kernels.find((k) => k.name === at.kernel).sizes.includes(at.size)) {
        fail(`${where}: \`portableProof\`'s size must be one of ${at.kernel}'s sizes`)
      }
      return at
    })
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
  if (minRatio.openssl === null) {
    fail(
      `${where}: \`portableMinRatio.openssl\` cannot be null: the same binary leaves only the time to prove it`
    )
  }
  if (spec.portableMinRatio !== undefined && proof === null) {
    fail(`${where}: \`portableMinRatio\` without a \`portableProof\``)
  }
  // The twins whose short ratio is settled by the paired rounds instead.
  const rounds = spec.portableRounds ?? []
  if (
    !(
      isStringList(rounds) &&
      new Set(rounds).size === rounds.length &&
      rounds.every((t) => t in PORTABLE_IDS && minRatio[t] !== null)
    )
  ) {
    fail(
      `${where}: \`portableRounds\` lists distinct twins (${Object.keys(PORTABLE_IDS).join(", ")}) whose portableMinRatio is a number`
    )
  }
  if (spec.portableRounds !== undefined && proof === null) {
    fail(`${where}: \`portableRounds\` without a \`portableProof\``)
  }
  // OpenSSL's proof is a time ratio, so it is held only on a CPU with an
  // extension whose loss slows the proof kernel; the mask may clear others.
  const mask = twins.openssl.portable?.env?.OPENSSL_ia32cap
  const proofFlags = spec.portableProofFlags
  if (proof !== null && mask !== undefined) {
    const cleared = ia32capCleared(mask)
    if (
      !(isStringList(proofFlags) && proofFlags.length > 0 && proofFlags.every((f) => cleared.includes(f)))
    ) {
      fail(
        `${where}: \`portableProofFlags\` lists the /proc/cpuinfo flags whose loss slows ${proof.map((c) => c.kernel).join(" or ")}, each one OPENSSL_ia32cap clears (${cleared.join(", ")})`
      )
    }
  } else if (proofFlags !== undefined) {
    fail(`${where}: \`portableProofFlags\` without a \`portableProof\` and an OPENSSL_ia32cap mask`)
  }
  const needs = spec.needs ?? []
  if (!(isStringList(needs) && needs.every((n) => n === "loopback"))) {
    fail(`${where}: \`needs\` is an array whose only allowed entry is "loopback"`)
  }
  if (kernels.some((k) => k.nish === true) && !fs.existsSync(path.join(dir, "main.ts"))) {
    fail(`${path.relative(root, dir)}: a kernel with \`nish\` true needs main.ts`)
  }
  const familyNotes = spec.notes ?? []
  if (!isStringList(familyNotes)) {
    fail(`${where}: \`notes\` is an array of strings, each a footnote under the family's table`)
  }
  return {
    name,
    dir,
    title: spec.title,
    kernels,
    twins,
    proof,
    proofFlags: proofFlags ?? [],
    minRatio,
    rounds: new Set(rounds),
    needs,
    notes: familyNotes,
  }
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
  .readdirSync(opts.families, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(opts.families, e.name, "family.json")))
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

/**
 * The line of a step's stderr that names why it stopped: its last `error`
 * line, since cargo follows one with notes and help, or else its last line.
 */
const stopLine = (r) => {
  const lines = (r.stderr ?? "").trim().split("\n")
  return lines.findLast((l) => /^error\b/.test(l)) ?? lines.pop()
}

/** Whether dotted version `a` is older than `b`, part by part. */
const olderThan = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number))
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) {
      return (x[i] ?? 0) < (y[i] ?? 0)
    }
  }
  return false
}

/**
 * A step that must work: a twin that does not build is a broken bench. A
 * failure whose stderr matches `tooOld` is a toolchain too old for the twin
 * instead, and comes back as the matching line; otherwise the result is null.
 */
const build = (what, cmd, args, { cwd = root, env = process.env, tooOld = null } = {}) => {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" })
  if (r.error !== undefined || r.status !== 0) {
    const old = tooOld === null ? null : (r.stderr ?? "").split("\n").find((l) => tooOld.test(l))
    if (old !== undefined && old !== null) {
      return old.trim()
    }
    console.error(`crypto: building ${what} failed (exit ${r.status})\n${r.error?.message ?? ""}${r.stderr}`)
    process.exit(1)
  }
  return null
}

/**
 * Exits 1 when a failed fetch's stderr names the twin's own manifest or
 * lockfile (`own`): a stale or unparseable one is the twin's bug, not the
 * host's, so it fails the run as a build that does not compile does.
 */
const ownFault = (what, r, own) => {
  if (own.test(r.stderr ?? "")) {
    console.error(`crypto: fetching ${what} failed (exit ${r.status})\n${r.error?.message ?? ""}${r.stderr}`)
    process.exit(1)
  }
}

const probeDir = path.join(outRoot, "probe")
/**
 * Whether clang links a program against OpenSSL's libcrypto and libssl, headers
 * included, given the C that goes before `main`.
 */
const opensslLinks = (head = "") => {
  fs.mkdirSync(probeDir, { recursive: true })
  const src = path.join(probeDir, "openssl.c")
  fs.writeFileSync(
    src,
    `#include <openssl/evp.h>\n#include <openssl/ssl.h>\n${head}int main(void) { return 0; }\n`
  )
  const r = spawnSync(CC, [src, "-o", path.join(probeDir, "openssl"), "-lssl", "-lcrypto"], {
    encoding: "utf8",
  })
  return r.error === undefined && r.status === 0
}
/** The twins call OpenSSL 3's fetch API (EVP_MD_fetch, EVP_MAC, EVP_KDF), which 1.1 lacks. */
const OPENSSL_3 = "#if OPENSSL_VERSION_NUMBER < 0x30000000L\n#error OpenSSL 3 or newer\n#endif\n"

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
let opensslWhy = `${CC} could not link against OpenSSL's headers and libraries`
if (!opts.skip.has("openssl") && tools.cc !== null && opensslLinks()) {
  if (opensslLinks(OPENSSL_3)) {
    tools.openssl = versionOf("openssl", ["version"]) ?? "OpenSSL (version unknown: no openssl command)"
  } else {
    opensslWhy = "OpenSSL's headers are older than 3, whose fetch API the twins call"
  }
}
/** Why a twin has no column on this machine when its toolchain is absent. */
const absent = {
  openssl: tools.openssl === null ? opensslWhy : null,
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

/** /proc/cpuinfo, or "" off Linux, where os.cpus() names the CPU and the flags are unknown. */
const cpuinfo = (() => {
  try {
    return fs.readFileSync("/proc/cpuinfo", "utf8")
  } catch {
    return ""
  }
})()
const cpuFlags = new Set((/^flags\s*:\s*(.+)$/m.exec(cpuinfo)?.[1] ?? "").split(/\s+/).filter(Boolean))

/** Where a portable column's assembly exists to be taken away; elsewhere its proof has nothing to measure. */
const PROOF_ARCHES = { openssl: ["x64"], go: ["x64", "arm64"], rust: ["x64", "arm64"] }

/**
 * Why this host cannot prove `twin`'s portable column, or null when it can: the
 * default build must have assembly here that the portable one gives up, and
 * for OpenSSL the CPU must have an extension the family's mask clears.
 */
const proofBlocked = (twin, family) => {
  if (!PROOF_ARCHES[twin].includes(os.arch())) {
    return `${TWIN_LABELS[twin]}'s assembly is checked on ${PROOF_ARCHES[twin].join(" and ")} only, and this is ${os.arch()}`
  }
  if (twin !== "openssl") {
    return null
  }
  const mask = family.twins.openssl.portable.env?.OPENSSL_ia32cap
  if (mask === undefined) {
    return "the portable env sets no OPENSSL_ia32cap to read"
  }
  if (cpuFlags.size === 0) {
    return "no /proc/cpuinfo flags to hold the mask against"
  }
  return family.proofFlags.some((f) => cpuFlags.has(f))
    ? null
    : `this CPU has none of ${family.proofFlags.join(", ")}, whose loss the proof measures`
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

/**
 * Copies `from` into `to`, subdirectories included, renaming `from`'s own
 * files by `rename`. A `target` directory is a local cargo build, never a source.
 */
const copyTree = (from, to, rename = {}) => {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => !(path.basename(src) === "target" && fs.statSync(src).isDirectory()),
  })
  for (const [name, renamed] of Object.entries(rename)) {
    if (fs.existsSync(path.join(to, name))) {
      fs.renameSync(path.join(to, name), path.join(to, renamed))
    }
  }
}

/** The CPU-capability masks a portable env may set; the caller's own never reach a default column. */
const CAP_MASKS = ["OPENSSL_ia32cap", "OPENSSL_armcap"]
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !CAP_MASKS.includes(k)))

/**
 * Why `id` has no column in `family` by the family's own word (no Nish kernel,
 * an absent twin or portable build, or a lack of every kernel this run asked
 * for), or null when the family has the column.
 */
const declaredAbsent = (family, id) => {
  const kernels = family.kernels.filter((k) => wanted(family, k))
  if (id === "nish") {
    return kernels.some((k) => k.nish === true) ? null : "no kernel run has a Nish column"
  }
  const twin = TWINS.find((name) => name === id || PORTABLE_IDS[name] === id)
  const t = family.twins[twin]
  const portable = id !== twin
  if (t.absent !== undefined) {
    return t.absent
  }
  if (portable && t.portable.absent !== undefined) {
    return t.portable.absent
  }
  const lacks = (k) => t.lacks[k.name] !== undefined || (portable && t.portable.lacks[k.name] !== undefined)
  return kernels.every(lacks) ? `lacks ${kernels.map((k) => k.name).join(", ")}` : null
}

/**
 * `family name -> id -> why` for each column the family has that this machine
 * did not build: the runner's own account, which --validate prints and the
 * table's footnotes repeat.
 */
const notBuilt = new Map()

/**
 * Builds a family's programs into build/bench/crypto/<family>/ and returns
 * its variants, one per column it can fill: `{ id, twin, portable, cmd, args, env }`.
 * Each column it cannot fill gets its reason in `notBuilt`.
 */
const buildFamily = (family) => {
  const dir = path.join(outRoot, family.name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const variants = []
  const add = (id, twin, portable, cmd, args, env = {}) =>
    variants.push({ id, twin, portable, cmd, args, env: { ...baseEnv, ...env } })
  const why = new Map()
  notBuilt.set(family.name, why)
  /** Records why `twin`'s columns were not built, and notes it once. */
  const unbuilt = (twin, reason) => {
    for (const id of [twin, PORTABLE_IDS[twin]].filter(Boolean)) {
      why.set(id, reason)
    }
    note(`${TWIN_LABELS[twin]}: ${family.name}: ${reason}; its columns read —`)
  }
  for (const twin of TWINS) {
    if (missing[twin] !== null) {
      for (const id of [twin, PORTABLE_IDS[twin]].filter(Boolean)) {
        why.set(id, missing[twin])
      }
    }
  }

  if (family.kernels.some((k) => k.nish === true)) {
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
    copyTree(path.join(family.dir, "go"), src)
    fs.copyFileSync(path.join(libDir, "gen.go"), path.join(src, "gen.go"))
    // No toolchain download and no workspace from above: the module as committed.
    const env = { ...process.env, GOTOOLCHAIN: "local", GOWORK: "off", GOFLAGS: "-mod=readonly", ...t.env }
    const wants = /^go (\d+(?:\.\d+)*)$/m.exec(fs.readFileSync(path.join(src, "go.mod"), "utf8"))?.[1]
    const has = /\bgo(\d+(?:\.\d+)*)/.exec(tools.go)?.[1]
    const fetched =
      wants !== undefined && has !== undefined && olderThan(has, wants)
        ? null
        : spawnSync(GO, ["mod", "download"], { cwd: src, env, encoding: "utf8" })
    if (fetched === null) {
      unbuilt("go", `Go ${has} is older than the go ${wants} its go.mod asks for`)
    } else if (fetched.status !== 0) {
      ownFault(`${family.name} (Go)`, fetched, /\bgo\.(?:mod|sum)\b/)
      unbuilt("go", `its modules did not download (${stopLine(fetched)})`)
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
    copyTree(path.join(family.dir, "rust"), crate, {
      "cargo.toml": "Cargo.toml",
      "cargo.lock": "Cargo.lock",
    })
    fs.copyFileSync(path.join(libDir, "gen.rs"), path.join(crate, "src", "gen.rs"))
    const bin = /^name\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(crate, "Cargo.toml"), "utf8"))?.[1]
    if (bin === undefined) {
      fail(`bench/crypto/${family.name}/rust/cargo.toml: no \`name = "…"\` line names the binary`)
    }
    // Both builds take their flags from CARGO_ENCODED_RUSTFLAGS alone, so a
    // RUSTFLAGS in the environment reaches neither and the pair differs only by
    // the portable flags.
    const env = { ...process.env, ...t.env, CARGO_ENCODED_RUSTFLAGS: "" }
    delete env.RUSTFLAGS
    const fetched = spawnSync("cargo", ["fetch", "--locked", "--quiet"], {
      cwd: crate,
      env,
      encoding: "utf8",
    })
    // A dependency whose rust-version is newer than this rustc is a toolchain
    // too old, like a Go older than its go.mod. The twin's own rust-version, and
    // any other build failure, is a bug. Cargo words the line `<crate>@<version>
    // requires rustc <v>`, and before 1.80 `package \`<crate> v<version> …\`
    // cannot be built because it requires rustc <v> or newer`.
    const own = new RegExp(`(?:^\\s*|package \`)${bin}(?:@| v)`)
    const cargo = (what, target, extra) => {
      const old = build(
        what,
        "cargo",
        ["build", "--release", "--locked", "--quiet", "--target-dir", target],
        {
          cwd: crate,
          env: { ...env, ...extra },
          tooOld: /requires rustc [\d.]+/,
        }
      )
      if (old !== null && own.test(old)) {
        console.error(
          `crypto: building ${what} failed: its own rust-version is newer than ${tools.rustc} (${old})`
        )
        process.exit(1)
      }
      return old
    }
    const old = fetched.status === 0 ? cargo(`${family.name} (Rust)`, path.join(crate, "target"), {}) : null
    if (fetched.status !== 0) {
      ownFault(`${family.name} (Rust)`, fetched, /\bCargo\.(?:toml|lock)\b/)
      unbuilt("rust", `its crates did not fetch (${stopLine(fetched)})`)
    } else if (old !== null) {
      unbuilt("rust", `${tools.rustc} is too old (${old})`)
    } else {
      add("rust", "rust", false, path.join(crate, "target", "release", bin), [], t.env)
      if (t.portable.absent === undefined) {
        // One flag per element, spaces and quotes kept, and a target directory
        // of its own so the two builds never share an artifact.
        const flags = { CARGO_ENCODED_RUSTFLAGS: (t.portable.rustflags ?? []).join("\x1f") }
        const softOld = cargo(`${family.name} (Rust portable)`, path.join(crate, "target-soft"), {
          ...flags,
          ...(t.portable.env ?? {}),
        })
        if (softOld === null) {
          add("rust-soft", "rust", true, path.join(crate, "target-soft", "release", bin), [], portableEnv(t))
        } else {
          why.set("rust-soft", `${tools.rustc} is too old (${softOld})`)
        }
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
    timeout: RUN_TIMEOUT_MS,
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    let why = r.error?.message ?? `exit ${r.status}`
    if (r.error?.code === "ETIMEDOUT") {
      why = `no answer within ${RUN_TIMEOUT_MS / 1000} s`
    }
    return { error: `${why}\nstdout: ${r.stdout ?? ""}\nstderr: ${r.stderr ?? ""}` }
  }
  return { checksum: sum[1], ns: Number(ns[1]) }
}

/**
 * The variants that implement `kernel`: Nish only where the kernel says so, a
 * twin unless it lacks it, and a portable column unless its build lacks it.
 */
const runnersOf = (family, kernel, variants) =>
  variants.filter((v) => {
    if (v.twin === null) {
      return kernel.nish === true
    }
    const t = family.twins[v.twin]
    return t.lacks[kernel.name] === undefined && !(v.portable && t.portable.lacks[kernel.name] !== undefined)
  })

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

/**
 * Every variant once per round, in json-compare's balanced order (rotated,
 * reversed every other block, the rounds rounded up so every variant takes
 * every position equally often): `{ id: [ns, …] }`, and the checksums seen,
 * `{ id: Set }`. A deterministic program prints one checksum every round, so a
 * set of two is a mismatch.
 */
const interleave = (variants, kernel, size, iterations, rounds) => {
  const times = new Map(variants.map((v) => [v.id, []]))
  const sums = new Map(variants.map((v) => [v.id, new Set()]))
  for (let round = 0; round < roundsFor(variants.length, rounds); round++) {
    for (const v of roundOrder(variants, round)) {
      const r = runOnce(v, kernel, size, iterations)
      if (r.error !== undefined) {
        console.error(`crypto: ${v.id} ${kernel} ${size} failed: ${r.error}`)
        process.exit(1)
      }
      times.get(v.id).push(r.ns)
      sums.get(v.id).add(r.checksum)
    }
  }
  return { times, sums }
}

/**
 * The fewest of `n` paired rounds the portable column must lose for a mask
 * that changed nothing to reach it with probability at most `alpha`: with the
 * same code on both sides each round is a coin toss, whatever the noise.
 */
const roundsNeeded = (n, alpha) => {
  let choose = 1
  let tail = 0
  for (let k = n; k >= 0; k--) {
    tail += choose / 2 ** n
    if (tail > alpha) {
      return k + 1
    }
    choose = (choose * k) / (n - k + 1)
  }
  return 0
}

// ---- --validate ------------------------------------------------------------------

if (opts.validate) {
  let mismatches = 0
  let kernelCount = 0
  const seen = new Set()
  // The column list the account below covers, so tests/run.js reads it from
  // here rather than keeping a copy a new column could slip past.
  const ids = COLUMNS.map(([id]) => id)
  console.log(`crypto: columns ${ids.join(", ")}`)
  for (const family of families) {
    if (!family.kernels.some((k) => wanted(family, k))) {
      continue
    }
    if (family.needs.includes("loopback") && !loopback) {
      note(`${family.name}: needs a loopback socket and 127.0.0.1 refused one; not validated`)
      console.log(`${family.name}: skipped (needs loopback)`)
      continue
    }
    const variants = buildFamily(family)
    const ranHere = new Set()
    const expected = readExpected(family)
    // --write-expected replaces the lines it ran and keeps the rest, so
    // `--only <kernel>` does not drop the other kernels' checksums.
    const written = new Map(expected)
    let matched = 0
    const checks = family.kernels
      .filter((k) => wanted(family, k))
      .flatMap((kernel) =>
        [...new Set([kernel.validateSize, ...kernel.sizes])].map((size) => ({ kernel, size }))
      )
    for (const { kernel, size } of checks) {
      const key = `${kernel.name} ${size} ${VALIDATE_ITERATIONS}`
      const want = expected.get(key)
      // nish-copy is nish's bytes: it can only print nish's checksum.
      const runners = runnersOf(family, kernel, variants).filter((v) => v.id !== "nish-copy")
      const sums = new Map()
      for (const v of runners) {
        const r = runOnce(v, kernel.name, size, VALIDATE_ITERATIONS)
        if (r.error !== undefined) {
          console.log(`FAILED ${kernel.name} ${size} ${v.id}: ${r.error}`)
          mismatches++
          continue
        }
        sums.set(v.id, r.checksum)
        seen.add(v.id)
        ranHere.add(v.id)
      }
      const distinct = new Set(sums.values())
      if (opts.writeExpected) {
        if (distinct.size !== 1) {
          console.log(
            `CHECKSUM MISMATCH ${kernel.name} ${size}: ${[...sums].map(([id, s]) => `${id} ${s}`).join(", ")}`
          )
          mismatches++
        } else {
          written.set(key, [...distinct][0])
        }
      } else if (want === undefined) {
        console.log(
          `CHECKSUM MISMATCH ${kernel.name} ${size}: bench/crypto/${family.name}/expected.txt has no \`${key}\` line`
        )
        mismatches++
      } else {
        for (const [id, sum] of sums) {
          if (sum !== want) {
            console.log(
              `CHECKSUM MISMATCH ${kernel.name} ${size} ${id}: printed ${sum}, expected.txt has ${want}`
            )
            mismatches++
          }
        }
        if ([...sums.values()].every((s) => s === want) && sums.size === runners.length) {
          matched++
        }
      }
      if (sums.size === 0) {
        console.log(`CHECKSUM MISMATCH ${kernel.name} ${size}: no variant ran`)
        mismatches++
      }
      kernelCount++
    }
    // Every column is accounted for: it ran, the family has none, or this
    // machine did not build it, and the line says why. The runner is the
    // authority here; tests/run.js reads these lines rather than probing.
    console.log(`${family.name}: ran ${ids.filter((id) => ranHere.has(id)).join(", ")}`)
    for (const id of ids.filter((c) => !ranHere.has(c))) {
      const declared = declaredAbsent(family, id)
      if (declared !== null) {
        console.log(`${family.name} has no ${id}: ${declared}`)
      } else {
        console.log(
          `${family.name} did not run ${id}: ${notBuilt.get(family.name).get(id) ?? "no check of this run reached it"}`
        )
      }
    }
    // A checksum only Nish printed is pinned by nothing: a twin must agree first.
    if (opts.writeExpected && ![...ranHere].some((id) => id !== "nish")) {
      console.log(`crypto: --write-expected for ${family.name} needs a twin to agree with Nish, and none ran`)
      mismatches++
    }
    if (opts.writeExpected && mismatches === 0) {
      const head =
        "# <kernel> <size> <iterations> <checksum>, written by `node bench/crypto/run.mjs --validate --write-expected`.\n"
      // In family.json's order: each kernel's sizes, smallest first.
      const rank = (k) => {
        const [name, size] = k.split(" ")
        return [family.kernels.findIndex((x) => x.name === name), Number(size)]
      }
      const lines = [...written]
        .sort(([a], [b]) => {
          const [ka, sa] = rank(a)
          const [kb, sb] = rank(b)
          return ka - kb || sa - sb
        })
        .map(([k, sum]) => `${k} ${sum}`)
      fs.writeFileSync(path.join(family.dir, "expected.txt"), `${head}${lines.join("\n")}\n`)
      console.log(`${family.name}: wrote expected.txt (${lines.length} line(s))`)
    } else if (!opts.writeExpected) {
      console.log(`${family.name}: ${matched} of ${checks.length} kernel size(s) match expected.txt`)
    }
    // The portable proof: each portable column must be measurably slower than
    // its twin's default one, so the mask, tag or flag really took the
    // assembly away. A twin whose ratio is null is measured and reported only.
    // The cases are tried in order and the first that reaches the minimum
    // proves the column: which assembly a mask takes away, and so how much it
    // costs, depends on the CPU.
    if (family.proof !== null && (!opts.only || opts.only.has(family.name))) {
      for (const twin of Object.keys(PORTABLE_IDS)) {
        const fast = variants.find((v) => v.id === twin)
        const slow = variants.find((v) => v.id === PORTABLE_IDS[twin])
        const t = family.twins[twin]
        const cases = family.proof.filter(
          ({ kernel }) => t.lacks?.[kernel] === undefined && t.portable?.lacks?.[kernel] === undefined
        )
        const first = family.proof[0].kernel
        let why = null
        if (t.absent !== undefined || t.portable.absent !== undefined) {
          why = "the family has no such column"
        } else if (cases.length === 0) {
          why =
            t.lacks[first] !== undefined ? `${twin} lacks ${first}` : `${PORTABLE_IDS[twin]} lacks ${first}`
        } else if (fast === undefined || slow === undefined) {
          why = `this machine built no ${fast === undefined ? twin : PORTABLE_IDS[twin]}`
        } else {
          why = proofBlocked(twin, family)
        }
        if (why !== null) {
          console.log(`portable ${family.name} ${PORTABLE_IDS[twin]}: unproved (${why})`)
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
        for (const [i, { kernel, size }] of cases.entries()) {
          // The fastest round of each: a shared machine's noise only ever adds time.
          // A short ratio is measured once more, longer, before it counts.
          const iterations = calibrate(fast, kernel, size, TARGET_NS / 2)
          const measure = (rounds) => {
            const { times } = interleave([fast, slow], kernel, size, iterations, rounds)
            return Math.min(...times.get(slow.id)) / Math.min(...times.get(fast.id))
          }
          let ratio = measure(5)
          if (need === null) {
            console.log(
              `portable ${family.name} ${slow.id}: other bytes than ${fast.id}; ${times3(ratio)} its time at ${kernel}@${size} (reported, not gated)`
            )
            break
          }
          if (ratio < need) {
            console.log(
              `retry ${family.name} ${slow.id}: ${times3(ratio)} at ${kernel}@${size} on the first measurement`
            )
            ratio = measure(11)
          }
          // A twin whose mask costs about as much as the ratio's noise on some
          // CPUs: the portable column must lose nearly every paired round.
          if (ratio < need && family.rounds.has(twin)) {
            // How many of the paired rounds the portable column lost.
            const pairs = () => {
              const { times } = interleave([fast, slow], kernel, size, iterations, PAIRED_ROUNDS)
              const fastNs = times.get(fast.id)
              return times.get(slow.id).filter((ns, r) => ns > fastNs[r]).length
            }
            const n = PAIRED_ROUNDS
            const want = roundsNeeded(n, PAIRED_ALPHA)
            let lost = pairs()
            // One more set on a miss, as the ratio gets: a real cost near the
            // noise misses one set now and then, and rarely two.
            if (lost < want) {
              console.log(
                `retry ${family.name} ${slow.id}: slower in ${lost} of ${n} paired rounds at ${kernel}@${size}`
              )
              lost = pairs()
            }
            const line = `${family.name} ${slow.id}: ${times3(ratio)} the time of ${fast.id} at ${kernel}@${size}, slower in ${lost} of ${n} paired rounds (needs ${times3(need)}, or ${want} of ${n})`
            if (lost >= want) {
              console.log(`portable ${line}`)
              break
            }
            if (cases[i + 1] === undefined) {
              console.log(`NOT PORTABLE ${line}`)
              mismatches++
              break
            }
            console.log(`short ${line}; trying ${cases[i + 1].kernel}@${cases[i + 1].size}`)
            continue
          }
          const next = cases[i + 1]
          if (ratio < need && next !== undefined) {
            console.log(
              `short ${family.name} ${slow.id}: ${times3(ratio)} the time of ${fast.id} at ${kernel}@${size} (needs ${times3(need)}); trying ${next.kernel}@${next.size}`
            )
            continue
          }
          const verdict = ratio >= need ? "portable" : "NOT PORTABLE"
          console.log(
            `${verdict} ${family.name} ${slow.id}: ${times3(ratio)} the time of ${fast.id} at ${kernel}@${size} (needs ${times3(need)})`
          )
          if (ratio < need) {
            mismatches++
          }
          break
        }
      }
    }
  }
  if (mismatches > 0) {
    console.log(`crypto: ${mismatches} mismatch(es); nothing is timed`)
    process.exit(1)
  }
  if (!opts.writeExpected) {
    console.log(
      `crypto: checksums agree over ${kernelCount} kernel size(s) and ${seen.size} variant(s): ${[...seen].join(", ")}`
    )
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
    if (runners.length === 0) {
      note(`${family.name}: no variant on this machine implements ${kernel.name}; not timed`)
      continue
    }
    for (const size of kernel.sizes) {
      const iterations = calibrate(runners[0], kernel.name, size, TARGET_NS)
      const { times, sums } = interleave(runners, kernel.name, size, iterations, opts.rounds)
      const [sum] = sums.get(runners[0].id)
      for (const [id, seen] of sums) {
        for (const s of seen) {
          if (s !== sum) {
            console.error(
              `CHECKSUM MISMATCH ${kernel.name} ${size} ${id}: printed ${s}, ${runners[0].id} printed ${sum}`
            )
            mismatches++
          }
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
  const model = /^model name\s*:\s*(.+)$/m.exec(cpuinfo)?.[1].trim() ?? os.cpus()[0]?.model ?? "unknown CPU"
  const listed = ["aes", "pclmulqdq", "sha_ni", "avx2", "avx512f"]
  const shown =
    cpuFlags.size > 0 ? listed.map((f) => `${f} ${cpuFlags.has(f) ? "yes" : "no"}`).join(", ") : "unknown"
  return `${model} (${os.arch()}, ${os.cpus().length} CPUs); flags: ${shown}`
}

/** The noise band of a row: how far Nish's median is from its byte-identical copy's. */
const bandOf = (row) => Math.abs(row.medians.get("nish") / row.medians.get("nish-copy") - 1)

/** A row's band for its column: `±1.2%`, or — without the copy. */
const bandCell = (row) => (row.medians.has("nish-copy") ? `±${(bandOf(row) * 100).toFixed(1)}%` : "—")

/** A quotient read against the noise band: `1.23x slower (rust-soft)`, or the band's word when within it. */
const verdict = (row, ids) => {
  const have = ids.filter((id) => row.medians.has(id))
  if (!row.medians.has("nish") || have.length === 0) {
    return "—"
  }
  const best = have.reduce((a, b) => (row.medians.get(b) < row.medians.get(a) ? b : a))
  const quotient = row.medians.get("nish") / row.medians.get(best)
  const side = sideOf(quotient, bandOf(row))
  return `${times3(quotient)} ${side === "within" ? "within the band" : side} (${best})`
}

const PORTABLE_COLUMN_IDS = Object.values(PORTABLE_IDS)
const lines = [
  "<!-- crypto:begin -->",
  "## Crypto against other languages",
  "",
  "Written by `node bench/crypto/run.mjs --record`, not by `bench/run.mjs`, which carries this section over when it rewrites the file. The programs, the inputs and the measurement rules are in [bench/crypto/README.md](../bench/crypto/README.md).",
  "",
  "Each cell is the median of the column's own timed loop over the rounds, every column at one iteration count per row, the order rotated each round and reversed on every other block. The last two columns divide Nish's median time by the fastest portable twin's (no assembly: OpenSSL under an `OPENSSL_ia32cap` mask, Go `-tags purego`, RustCrypto's soft backend) and by the fastest default twin's (assembly and CPU extensions allowed); above 1.000x Nish is slower. The Band column is the row's noise band, the gap between Nish and a byte-identical copy of its binary, and each quotient beside it is read against it: within the band is no difference.",
  "",
  `Machine: ${machine()}.`,
  "",
  `Toolchains: Nish ${tools.nish.replace(/^nish /, "")}; ${tools.cc?.replace(/\s*\(.*$/, "") ?? "no C compiler"}${tools.openssl ? `, ${tools.openssl}` : ""}; ${tools.go ?? "no Go"}; ${tools.rustc ?? "no Rust"}; Node ${tools.node ?? "—"}. ${opts.rounds} round(s) asked, each case rounded up to a multiple of twice its columns.`,
  "",
]
for (const { family, variants, rows } of sections) {
  const ids = new Set(variants.map((v) => v.id))
  lines.push(`### ${family.title} (\`bench/crypto/${family.name}\`)`, "")
  lines.push(
    `| Kernel | Size | Unit | ${COLUMNS.map(([, l]) => l).join(" | ")} | Band | Nish / best portable | Nish / best assembly |`,
    `| --- | --- | --- | ${COLUMNS.map(() => "---:").join(" | ")} | ---: | --- | --- |`
  )
  for (const row of rows) {
    const cell = (id) => {
      const ns = row.medians.get(id)
      return ns === undefined ? "—" : fmtRate(rateOf(row.kernel.unit, row.size, row.iterations, ns))
    }
    lines.push(
      `| ${row.kernel.name} | ${fmtSize(row.size)} | ${row.kernel.unit} | ${COLUMNS.map(([id]) => cell(id)).join(" | ")} | ${bandCell(row)} | ${verdict(row, PORTABLE_COLUMN_IDS)} | ${verdict(row, TWINS)} |`
    )
  }
  lines.push("")
  // Every — in the table says why.
  const why = []
  for (const twin of TWINS) {
    const t = family.twins[twin]
    if (t.absent !== undefined) {
      why.push(`${TWIN_LABELS[twin]}: ${t.absent}`)
      continue
    }
    if (!ids.has(twin)) {
      why.push(
        `${TWIN_LABELS[twin]}: not on this machine (${missing[twin] ?? notBuilt.get(family.name)?.get(twin) ?? "see the run's notes"})`
      )
    }
    for (const [kernel, reason] of Object.entries(t.lacks)) {
      why.push(`${TWIN_LABELS[twin]} has no ${kernel}: ${reason}`)
    }
    if (t.portable.absent !== undefined) {
      why.push(`${TWIN_LABELS[twin]} has no portable column: ${t.portable.absent}`)
    }
    for (const [kernel, reason] of Object.entries(t.portable.lacks)) {
      why.push(`${TWIN_LABELS[twin]} has no portable ${kernel}: ${reason}`)
    }
  }
  for (const kernel of family.kernels.filter((k) => k.nish !== true)) {
    why.push(`${kernel.name} has no Nish column: ${kernel.nish}`)
  }
  why.push(...family.notes)
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
  // Both markers once, in order, or neither: anything else is a hand edit
  // that a splice or an append would turn into a second section.
  const count = (marker) => text.split(marker).length - 1
  if (count(begin) > 1 || count(end) > 1 || from < 0 !== to < 0 || to < from) {
    fail(`${path.relative(root, file)}: want ${begin} and ${end} once each, in that order, or neither`)
  }
  const next =
    from >= 0
      ? `${text.slice(0, from)}${section}${text.slice(to + end.length)}`
      : `${text.trimEnd()}\n\n${section}\n`
  fs.writeFileSync(file, next)
  console.error(`recorded in ${path.relative(root, file)}`)
}
