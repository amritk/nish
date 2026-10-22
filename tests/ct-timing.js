/**
 * The timing half of WP34 N6 (#316): a dudect-style test of every function a
 * constant-time fixture names.
 *
 * `tests/ct-asm.js` reads the machine code and refuses a branch or a
 * secret-indexed access; it cannot see what the processor does with the
 * instructions it passes, such as a multiply whose latency depends on its
 * operands. This measures that instead. Each `tests/cases/ct_asm_*.ts` is
 * compiled the way `tests/run.js` compiles it, linked with the runtime and
 * with a small C file written here that calls each function its `// ct-check:`
 * lines name, and `tests/ct-timing/dudect.c` times those calls on a fixed and
 * a random secret and runs Welch's t-test between the two. A new fixture joins
 * by existing.
 *
 * A fixture's `expect=` functions are written to leak, and most are left out:
 * a secret-indexed load into a table that sits in L1 need not show in time.
 * The `expect=branch` ones are kept, as the **control**. `naiveEqual` returns at
 * the first differing byte, so the fixed class runs its loop to the end and the
 * random one stops at once, and a harness that could not tell those two apart
 * could not tell anything apart: its quiet verdict on the rest would be worth
 * nothing. A control that does not differ is a failed run, not a pass.
 *
 * The secret inputs are the ones the `ct-check` line names: a `secret=`
 * parameter, and under `contents` every element of every array argument. Class
 * 0 sets them all to zero, class 1 to fresh random bits for every measurement;
 * everything else is zero in both. Every array is `ELEMENTS` long, which is
 * more than any fixture indexes, and every one is reset before each
 * measurement, since some of the functions write their arguments. A fixture
 * whose module only ever passes narrower values than its types hold has them
 * narrowed to that domain, in both classes (`DOMAINS`), and is timed with a
 * control of its own: a leak written in C on inputs narrowed the same way,
 * which must differ like any other.
 *
 *   node tests/ct-timing.js            the full run, SAMPLES measurements a function
 *   node tests/ct-timing.js --quick    a smoke run, QUICK_SAMPLES a function
 *   node tests/ct-timing.js --samples <n> [--seed <n>] [--nish <compiler>] [<fixture substring>]
 *   ... --function <name>              time that one function alone, with the controls
 *   ... --out-of-domain                time a `DOMAINS` fixture on its types' whole range
 *   ... --null                         the A/A run: both classes prepared alike, so every
 *                                      |t| is noise, and the table is the false-positive rate
 *   ... --no-aa                        leave out the same-runner A/A pass (below)
 *
 * A function is timed 102 ways at once (uncropped, 100 cropped percentiles and
 * a second-order test), and the largest |t| of 102 correlated tests on a
 * shared machine crosses 4.5 now and then with no leak behind it. So a
 * function above 4.5 is timed again, by itself in the same linked driver, on a
 * fresh seed derived from the run's, and is a finding only when it crosses on
 * both (docs/security/ct-verification.md, "The re-measure rule"). One that
 * crossed once and not again stays in the table, as "crossed once, did not
 * repeat". A control is never re-measured: it must differ on its first
 * measurement.
 *
 * A reading is only worth something next to the machine it was taken on, and
 * the CI runners land on whatever CPU is free. So the output opens with the
 * CPU's fingerprint, read from the kernel (`cpuFingerprint`), and every timing
 * run ends with one A/A pass in the same linked drivers, on its own seed: both
 * classes prepared alike, as `--null` does, so whatever crosses there is this
 * machine's false alarm, measured in the same job as the table it sits beside.
 * The A/A pass never changes the exit code. It qualifies a finding rather than
 * clearing one: a function the timing pass flagged that crosses in the A/A
 * pass too is named as such in the summary, and the run still exits 1. It
 * bounds false alarms on one machine and makes them neither zero nor
 * impossible elsewhere, and it cannot make a weak leak visible.
 *
 * It prints a Markdown table and exits 1 when a function's largest |t| is above
 * 4.5 on both measurements, 2 when it could not run or a control did not
 * differ, and 0 otherwise (an A/A run exits 0 or 2). It
 * is not part of `npm test`: the numbers are about the machine it runs on, and
 * a shared runner is noisy, so `.github/workflows/ct-timing.yml` runs it weekly
 * and files what it finds as an issue rather than as a red pull request.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ctSpecs } from "./ct-asm.js"

const root = path.resolve(import.meta.dirname, "..")
const casesDir = path.join(root, "tests", "cases")
const workDir = path.join(root, "build", "ct-timing")
const DUDECT_C = path.join(root, "tests", "ct-timing", "dudect.c")
// Every unit of the native runtime, read from the directory rather than listed,
// so a new one cannot be missed by a harness `npm test` never runs. The wasm
// unit is the one runtime/ file that is not part of a native link.
const RUNTIME_C = fs
  .readdirSync(path.join(root, "runtime"))
  .filter((f) => /^runtime(-[a-z]+)?\.c$/.test(f) && f !== "runtime-wasm.c")
  .map((f) => path.join(root, "runtime", f))

/**
 * A |t| above this is read as a difference between the classes: the
 * side-channel literature's 4.5, which the dudect paper follows. dudect's own
 * code fails at 10, so this is the stricter reading.
 */
const THRESHOLD = 4.5
/** Enough measurements a function for a |t| near the threshold to mean something. */
const SAMPLES = 1000000
const QUICK_SAMPLES = 4000
/** The fixture whose `expect=branch` functions are the control (see the header). */
const CONTROL_FIXTURE = "ct_asm_refused.ts"
/** Elements in every array argument: more than any fixture indexes. */
const ELEMENTS = 256

/**
 * The inputs a fixture's functions are ever given, where that is narrower than
 * their types, keyed by fixture and then by every function it times. `limbs`
 * narrows each secret `i64[]` to signed limbs of magnitude below 2^limbs, and
 * `scalar` masks each secret scalar other than a `boolean`. Out of its domain a
 * function runs on values its module never makes, and a difference there says
 * nothing about the module: CT-13 in docs/security/ct-verification.md is the
 * reading that taught this.
 */
const DOMAINS = {
  "ct_asm_x25519.ts": {
    // std/crypto/x25519.ts: `f25519Mul` and `f25519MulA24` are handed the sum or
    // difference of two reduced elements, signed and below 2^27 (`f25519Add`, `f25519Sub`).
    fieldMul: { limbs: 27 },
    fieldSquare: { limbs: 27 },
    fieldMulA24: { limbs: 27 },
    // The rest are handed reduced elements, below 2^26 in magnitude (`f25519Carry`,
    // limb 1's final carry included), and a swap bit of 0 or 1.
    fieldAdd: { limbs: 26 },
    fieldSub: { limbs: 26 },
    condSwap: { limbs: 26, scalar: 1 },
    ladderStep: { limbs: 26, scalar: 1 },
  },
}

/**
 * The `prepare` lines that fill an array's buffer for class `cls` and, given
 * `bits`, narrow it to signed limbs below 2^bits. A fixture's function and a
 * domain's control both build their lines here, from one buffer name, so the
 * narrowing a control is timed through is the one the fixture gets.
 */
const fillArray = (buffer, bytes, cls, bits) => [
  `  ct_fill(${buffer}, ${bytes}, ${cls});`,
  ...(bits === undefined ? [] : [`  ct_signed_limbs((int64_t *)${buffer}, ${ELEMENTS}, ${bits});`]),
]

/** `fillArray` for a scalar: fill `variable` for class `cls` and, given `mask`, mask it. */
const fillScalar = (variable, cls, mask) => [
  `  ct_fill(&${variable}, sizeof ${variable}, ${cls});`,
  ...(mask === undefined ? [] : [`  ${variable} &= ${mask};`]),
]

/**
 * The C that times a domain's own controls: for each limb width and each scalar
 * mask the domain uses, a buffer or scalar filled and narrowed by `fillArray`
 * or `fillScalar`, as the fixture's are, and handed to a leak in `dudect.c`.
 * A narrowing that erased the secret (`ct_signed_limbs`, or a bound or mask in
 * `DOMAINS`, gone to zero) leaves both classes equal, so the control does not
 * differ and the run fails. They are not the fixture's control: CT-12's
 * `expect=branch` functions are still required.
 */
const domainControls = (domain, first) => {
  const lines = []
  const table = []
  const names = []
  const entries = Object.values(domain)
  const widths = [...new Set(entries.map((e) => e.limbs).filter((b) => b !== undefined))]
  const masks = [...new Set(entries.map((e) => e.scalar).filter((m) => m !== undefined))]
  for (const [k, bits] of widths.entries()) {
    const n = `k${first + k}`
    lines.push(
      `static _Alignas(16) unsigned char ${n}_d[${ELEMENTS * 8}];`,
      `static void ${n}_prepare(int c) {`,
      ...fillArray(`${n}_d`, ELEMENTS * 8, "c", bits),
      "}",
      `static void ${n}_call(void) { sink = (uint64_t)ct_first_nonzero((const int64_t *)${n}_d, ${ELEMENTS}); }`,
      ""
    )
    names.push(`domain control: limbs below 2^${bits}`)
    table.push(`  { "${names.at(-1)}", ${n}_prepare, ${n}_call },`)
  }
  for (const [k, mask] of masks.entries()) {
    const n = `k${first + widths.length + k}`
    lines.push(
      `static int64_t ${n}_s;`,
      `static void ${n}_prepare(int c) {`,
      ...fillScalar(`${n}_s`, "c", mask),
      "}",
      `static void ${n}_call(void) { sink = ct_work_if(${n}_s); }`,
      ""
    )
    names.push(`domain control: scalar & ${mask}`)
    table.push(`  { "${names.at(-1)}", ${n}_prepare, ${n}_call },`)
  }
  return { lines, table, names }
}

/** The C type of each scalar a fixture may take, and each element's size in bytes. */
const C_TYPES = {
  i8: ["int8_t", 1],
  u8: ["uint8_t", 1],
  i16: ["int16_t", 2],
  u16: ["uint16_t", 2],
  i32: ["int32_t", 4],
  u32: ["uint32_t", 4],
  i64: ["int64_t", 8],
  u64: ["uint64_t", 8],
  boolean: ["bool", 1],
}

const fail = (message) => {
  console.error(`ct-timing: ${message}`)
  process.exit(2)
}

const args = process.argv.slice(2)
let samples = SAMPLES
// Never 0: dudect.c reads a seed of 0 as "keep the built-in one".
let seed = (Date.now() % 1000000007) + 1
let nish = null
let only = null
let onlyFunction = null
let outOfDomain = false
let nullRun = false
let aaPass = true
/** The value after the option at `i`, refusing an option given last or followed by another. */
const optionValue = (i) => {
  const value = args[i + 1]
  if (value === undefined || value.startsWith("-")) {
    fail(`${args[i]} is missing its value (see the header of tests/ct-timing.js)`)
  }
  return value
}
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--quick") {
    samples = QUICK_SAMPLES
  } else if (args[i] === "--samples") {
    samples = Number(optionValue(i++))
  } else if (args[i] === "--seed") {
    seed = Number(optionValue(i++))
  } else if (args[i] === "--nish") {
    nish = path.resolve(optionValue(i++))
  } else if (args[i] === "--function") {
    onlyFunction = optionValue(i++)
  } else if (args[i] === "--out-of-domain") {
    outOfDomain = true
  } else if (args[i] === "--null") {
    nullRun = true
  } else if (args[i] === "--no-aa") {
    aaPass = false
  } else if (args[i].startsWith("-")) {
    fail(`unknown option ${args[i]} (see the header of tests/ct-timing.js)`)
  } else {
    only = args[i]
  }
}
if (!Number.isInteger(samples) || samples < 1000) {
  fail("--samples needs a whole number of at least 1000")
}
if (!Number.isSafeInteger(seed) || seed < 1) {
  fail("--seed needs a whole number of at least 1, which is what makes a run repeatable")
}
if (nish !== null && !fs.existsSync(nish)) {
  fail(`--nish ${nish}: no compiler there`)
}
if (nish === null) {
  // build/nish is what CI builds and `npm run build` leaves; build/nish-test is what `npm test` leaves.
  nish = ["nish", "nish-test"].map((n) => path.join(root, "build", n)).find((p) => fs.existsSync(p))
  if (nish === undefined) {
    fail("no compiler in build/: run `npm run build` (or `npm test`), or name one with --nish")
  }
}

/**
 * The Arm cores named by their MIDR_EL1 implementer and part, as each core's
 * Technical Reference Manual gives them ("MIDR_EL1, Main ID Register") and
 * Linux's arch/arm64/include/asm/cputype.h spells them. A part not here is
 * printed by its raw values only: a name guessed for it would be worse than none.
 */
const ARM_PARTS = {
  "0x41:0xd0c": "Arm Neoverse N1",
  "0x41:0xd40": "Arm Neoverse V1",
  "0x41:0xd49": "Arm Neoverse N2",
  "0x41:0xd4f": "Arm Neoverse V2",
}

/** A file's contents trimmed, or null when it is not there or cannot be read. */
const readKernel = (file) => {
  try {
    return fs.readFileSync(file, "utf8").trim()
  } catch {
    return null
  }
}

/**
 * One line that says which CPU the run was timed on, read from the kernel:
 * `/proc/cpuinfo`'s first processor, the identification register and the
 * frequency-boost switches in sysfs, and the kernel release. The CI runners
 * land on different CPUs from week to week, and a marketing string (all
 * `os.cpus()` gives on x86, and nothing at all on arm64) cannot tell an Ice
 * Lake from a Sapphire Rapids. A field the kernel does not give prints as
 * "unreadable", never as a default, so a missing value cannot pass for one.
 */
const cpuFingerprint = () => {
  const cpus = os.cpus()
  const cpuinfo = os.platform() === "linux" ? readKernel("/proc/cpuinfo") : null
  if (cpuinfo === null) {
    const where =
      os.platform() === "linux" ? "/proc/cpuinfo is unreadable" : `this is ${os.platform()}, not Linux`
    return `ct-timing: CPU from os.cpus() only (${where}): ${os.arch()}, "${cpus[0]?.model.trim() ?? "unreadable"}", ${cpus.length} logical CPUs, kernel ${os.release()}`
  }
  // The first processor's block: each "key : value" line up to the first blank one.
  const fields = new Map()
  for (const line of cpuinfo.split("\n\n")[0].split("\n")) {
    const colon = line.indexOf(":")
    if (colon > 0) {
      fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
    }
  }
  const field = (key) => fields.get(key) ?? "unreadable"
  const parts = []
  if (fields.has("vendor_id")) {
    parts.push(
      `${os.arch()} ${field("vendor_id")} family ${field("cpu family")} model ${field("model")} stepping ${field("stepping")} microcode ${field("microcode")} "${field("model name")}"`
    )
    const flags = fields.get("flags")
    parts.push(
      flags === undefined
        ? "hypervisor flag unreadable"
        : `hypervisor flag ${flags.split(/\s+/).includes("hypervisor") ? "set" : "not set"}`
    )
  } else {
    const implementer = field("CPU implementer")
    const part = field("CPU part")
    const name = ARM_PARTS[`${implementer}:${part}`]
    parts.push(
      `${os.arch()} implementer ${implementer} part ${part}${name === undefined ? "" : ` (${name})`} variant ${field("CPU variant")} revision ${field("CPU revision")}`
    )
    const midr = readKernel("/sys/devices/system/cpu/cpu0/regs/identification/midr_el1")
    parts.push(`MIDR_EL1 ${midr ?? "unreadable"}`)
    // aarch64's cpuinfo has no flag for it, and its absence is not "not set".
    parts.push("hypervisor flag unreadable")
  }
  parts.push(`cpufreq boost ${readKernel("/sys/devices/system/cpu/cpufreq/boost") ?? "unreadable"}`)
  parts.push(
    `intel_pstate no_turbo ${readKernel("/sys/devices/system/cpu/intel_pstate/no_turbo") ?? "unreadable"}`
  )
  parts.push(`kernel ${readKernel("/proc/sys/kernel/osrelease") ?? "unreadable"}`)
  parts.push(`${cpus.length} logical CPUs`)
  return `ct-timing: CPU (cpu0, from /proc/cpuinfo and sysfs): ${parts.join("; ")}`
}

/**
 * The C file that calls one fixture's functions: for each, static buffers and
 * headers for its arrays, a `prepare` that fills its secrets for a class, and
 * a `call` that makes the call and keeps the answer where the optimiser cannot
 * drop it. With a `domain`, each function's secrets are narrowed to its
 * entry there, and the domain's controls are added (`domainControls`). An
 * `error` when a signature has a type it cannot build, or a domain does not
 * fit the functions it names.
 */
const driverFor = (specs, domain) => {
  const lines = ["#include <stdbool.h>", '#include "dudect.h"', "", "static volatile uint64_t sink;", ""]
  const table = []
  const untimed = Object.keys(domain ?? {}).find((fn) => !specs.some((spec) => spec.name === fn))
  if (untimed !== undefined) {
    return { error: `its domain names ${untimed}, which it does not time` }
  }
  for (const [n, spec] of specs.entries()) {
    const params = []
    const fills = []
    const decls = []
    const entry = domain?.[spec.name]
    if (domain !== undefined && entry === undefined) {
      return { error: `its domain has no entry for ${spec.name}` }
    }
    // Each narrowing an entry gives must meet a secret it narrows, or the entry says more than is timed.
    let usedLimbs = false
    let usedScalar = false
    for (const [i, type] of spec.types.entries()) {
      const secret = spec.secretArgs.includes(i)
      if (type.endsWith("[]")) {
        const element = C_TYPES[type.slice(0, -2)]
        if (element === undefined) {
          return { error: `cannot call ${spec.name}: an array of ${type.slice(0, -2)}` }
        }
        const bytes = ELEMENTS * element[1]
        const buffer = `f${n}_d${i}`
        decls.push(`static _Alignas(16) unsigned char ${buffer}[${bytes}];`)
        decls.push(`static ct_array f${n}_a${i} = { ${ELEMENTS}, ${ELEMENTS}, ${buffer} };`)
        const filled = secret || spec.contents
        const narrowed = entry !== undefined && filled
        if (narrowed && (type !== "i64[]" || entry.limbs === undefined)) {
          return { error: `the domain of ${spec.name} gives no limbs for its secret ${type}` }
        }
        fills.push(...fillArray(buffer, bytes, filled ? "c" : "0", narrowed ? entry.limbs : undefined))
        usedLimbs ||= narrowed
        params.push(["ct_array *", `&f${n}_a${i}`])
      } else {
        const scalar = C_TYPES[type]
        if (scalar === undefined) {
          return { error: `cannot call ${spec.name}: a parameter of type ${type}` }
        }
        const variable = `f${n}_s${i}`
        decls.push(`static ${scalar[0]} ${variable};`)
        // A boolean is narrowed by its own type, below; every other secret scalar by its entry.
        const narrowed = entry !== undefined && secret && scalar[0] !== "bool"
        if (narrowed && entry.scalar === undefined) {
          return { error: `the domain of ${spec.name} gives no mask for its secret ${type}` }
        }
        fills.push(...fillScalar(variable, secret ? "c" : "0", narrowed ? entry.scalar : undefined))
        usedScalar ||= narrowed
        if (scalar[0] === "bool") {
          fills.push(`  ${variable} = (*(unsigned char *)&${variable} & 1) != 0;`)
        }
        params.push([scalar[0], variable])
      }
    }
    if (
      entry !== undefined &&
      ((entry.limbs !== undefined && !usedLimbs) || (entry.scalar !== undefined && !usedScalar))
    ) {
      return { error: `the domain of ${spec.name} narrows a secret it does not take` }
    }
    // A pointer answer (an array, a string, `T | null`) is one register like any other.
    const returns = spec.returns === "void" ? "void" : (C_TYPES[spec.returns]?.[0] ?? "void *")
    const call = `${spec.name}(${params.map((p) => p[1]).join(", ")})`
    lines.push(`${returns} ${spec.name}(${params.map((p) => p[0]).join(", ") || "void"});`)
    lines.push(...decls)
    lines.push(`static void f${n}_prepare(int c) {`, ...fills, "}")
    lines.push(
      `static void f${n}_call(void) { ${returns === "void" ? `${call};` : `sink = (uint64_t)(uintptr_t)${call};`} }`,
      ""
    )
    table.push(`  { "${spec.name}", f${n}_prepare, f${n}_call },`)
  }
  const controls =
    domain === undefined ? { lines: [], table: [], names: [] } : domainControls(domain, specs.length)
  lines.push(...controls.lines)
  table.push(...controls.table)
  lines.push("const ct_function ct_functions[] = {", ...table, "};")
  lines.push(`const int ct_function_count = ${table.length};`, "")
  return { source: lines.join("\n"), controls: controls.names }
}

/** The `.args` of a case, as tests/run.js hands them to the compiler. */
const caseArgs = (name) => {
  const file = path.join(casesDir, `${name}.args`)
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : []
}

fs.rmSync(workDir, { recursive: true, force: true })
fs.mkdirSync(workDir, { recursive: true })
const fixtures = fs
  .readdirSync(casesDir)
  // The control's fixture runs whatever the filter, so a filtered run is checked too.
  .filter((f) => /^ct_asm_\w+\.ts$/.test(f) && (only === null || f.includes(only) || f === CONTROL_FIXTURE))
  .sort()
// A domain is only read when its fixture runs, so one left behind by a rename would narrow nothing, silently.
const stale = Object.keys(DOMAINS).find((f) => !fs.existsSync(path.join(casesDir, f)))
if (stale !== undefined) {
  fail(`DOMAINS names ${stale}, and there is no tests/cases/${stale}`)
}
// The control alone is not a match: a misspelt filter would otherwise run only it.
if (only === null ? fixtures.length === 0 : !fixtures.some((f) => f.includes(only))) {
  fail(`no tests/cases/ct_asm_*.ts${only === null ? "" : ` matches ${only}`}`)
}

/**
 * The seed a function over the threshold is re-measured on: the run's seed
 * times an odd 64-bit constant, so another stream of `ct_random` that is never
 * zero, and one fixed by `--seed`, so a run repeats with its re-measures.
 */
const freshSeed = String((BigInt(seed) * 0x9e3779b97f4a7c15n) % (1n << 64n))
/**
 * The same-runner A/A pass's seed, by another odd constant so it shares a
 * stream with neither of the above, and the seed its crossings are re-measured
 * on, derived from it as `freshSeed` is from the run's.
 */
const aaSeed = (BigInt(seed) * 0xbf58476d1ce4e5b9n) % (1n << 64n)
const aaFreshSeed = String((aaSeed * 0x9e3779b97f4a7c15n) % (1n << 64n))

/**
 * One run of a fixture's driver on `runSeed`, of `names` alone when it is
 * given: a reading per function, as `tests/ct-timing/dudect.c` prints them.
 * With `asNull`, both classes are prepared as class 1 (the A/A run).
 */
const measure = (name, exe, runSeed, names = [], asNull = nullRun) => {
  const run = spawnSync(exe, [String(samples), String(runSeed), ...(asNull ? ["--null"] : []), ...names], {
    encoding: "utf8",
    maxBuffer: 1 << 24,
  })
  if (run.status !== 0) {
    fail(`${name} exited ${run.status}:\n${run.stderr}`)
  }
  return run.stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [fn, batch, max, test, used, raw] = line.split("\t")
      return { fn, batch, max: Number(max), test, used, raw }
    })
}

// Read before anything is timed, so it describes the machine as the run found it.
const fingerprint = cpuFingerprint()
const rows = []
/** Each fixture's linked driver, kept for the A/A pass so it runs in the layout the table was read in. */
const drivers = []
for (const file of fixtures) {
  const name = file.slice(0, -".ts".length)
  const all = ctSpecs(fs.readFileSync(path.join(casesDir, file), "utf8"))
  const broken = all.filter((spec) => spec.problems.length > 0)
  if (broken.length > 0) {
    fail(`${name}: ${broken.map((spec) => `${spec.name}: ${spec.problems.join("; ")}`).join("\n")}`)
  }
  // With --function, the named function and the control's `expect=branch` ones; else all but the other seeds.
  const specs = all.filter(
    (spec) =>
      (spec.expect === null || spec.expect === "branch") &&
      (onlyFunction === null ||
        spec.name === onlyFunction ||
        (file === CONTROL_FIXTURE && spec.expect === "branch"))
  )
  if (specs.length === 0) {
    continue
  }
  const ll = path.join(workDir, `${name}.ll`)
  const built = spawnSync(nish, [path.join(casesDir, file), ...caseArgs(name), "-o", ll], {
    cwd: root,
    encoding: "utf8",
  })
  if (built.status !== 0) {
    fail(`${name} does not compile:\n${built.stderr}`)
  }
  // The driver brings the `main`, so a fixture's own becomes an ordinary function.
  fs.writeFileSync(
    ll,
    fs.readFileSync(ll, "utf8").replace(/^(define [^@\n]*)@main\(/m, "$1@ct_fixture_main(")
  )
  // A domain narrows the functions timed here; --function leaves it fewer of them, --out-of-domain none.
  const domain =
    outOfDomain || DOMAINS[file] === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(DOMAINS[file]).filter(([fn]) => specs.some((spec) => spec.name === fn))
        )
  const driver = driverFor(specs, domain)
  if (driver.error !== undefined) {
    fail(`${name}: ${driver.error}`)
  }
  const driverC = path.join(workDir, `${name}.c`)
  fs.writeFileSync(driverC, driver.source)
  const exe = path.join(workDir, name)
  const cc = spawnSync(
    "clang",
    [
      "-O2",
      "-Wno-override-module",
      `-I${path.dirname(DUDECT_C)}`,
      ll,
      driverC,
      DUDECT_C,
      ...RUNTIME_C,
      "-lm",
      "-o",
      exe,
    ],
    { cwd: root, encoding: "utf8" }
  )
  if (cc.status !== 0) {
    fail(`${name} does not link:\n${cc.stderr}`)
  }
  const controls = new Set(specs.filter((spec) => spec.expect !== null).map((spec) => spec.name))
  const domainControlNames = new Set(driver.controls)
  for (const reading of measure(name, exe, seed)) {
    // A domain's controls must differ like the others, but only an `expect=branch` function is the run's control.
    const domainControl = domainControlNames.has(reading.fn)
    // Under --null no class differs, so a control is read like any other function.
    const control = !nullRun && (controls.has(reading.fn) || domainControl)
    // A function over the threshold is timed again, by itself in the same driver, on a fresh seed, and is
    // a finding only if it crosses again. A control is never re-measured: it must differ the first time.
    const again =
      !control && reading.max > THRESHOLD ? measure(name, exe, freshSeed, [reading.fn])[0].max : null
    rows.push({ fixture: name, ...reading, again, control, domainControl })
  }
  drivers.push({ name, exe })
  // A control that printed no row was never timed, and would otherwise pass unseen.
  const silent = driver.controls.filter((fn) => !rows.some((r) => r.fixture === name && r.fn === fn))
  if (silent.length > 0) {
    fail(`${name}: ${silent.join(", ")} printed no reading`)
  }
}

if (onlyFunction !== null && !rows.some((r) => r.fn === onlyFunction)) {
  fail(`--function ${onlyFunction}: no ct_asm_* fixture${only === null ? "" : ` matching ${only}`} times it`)
}

/**
 * The same-runner A/A pass: every driver run once more under `--null`, on
 * `aaSeed`, after the timing pass and in the same linked binaries, with the
 * re-measure rule applied as it is to the timing pass. Keyed by fixture and
 * function; empty under `--null`, which is an A/A run already, and `--no-aa`.
 */
const aa = new Map()
if (aaPass && !nullRun) {
  for (const { name, exe } of drivers) {
    for (const reading of measure(name, exe, aaSeed, [], true)) {
      const again =
        reading.max > THRESHOLD ? measure(name, exe, aaFreshSeed, [reading.fn], true)[0].max : null
      aa.set(`${name}\t${reading.fn}`, { fixture: name, fn: reading.fn, max: reading.max, again })
    }
  }
}

console.log(fingerprint)
console.log(
  `ct-timing: ${samples} measurements a function, seed ${seed}, re-measured on seed ${freshSeed}; threshold |t| > ${THRESHOLD}${nullRun ? "; the A/A run (--null): both classes are class 1" : ""}${aa.size > 0 ? `; same-runner A/A pass on seed ${aaSeed}, re-measured on seed ${aaFreshSeed}` : ""}`
)
console.log("")
const aaColumn = aa.size > 0
console.log(
  `| fixture | function | batch | max \\|t\\| | from test | per class | uncropped t | re-measured \\|t\\| | verdict |${aaColumn ? " A/A \\|t\\| |" : ""}`
)
console.log(`| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- |${aaColumn ? " ---: |" : ""}`)
/** An A/A reading as its table cell: the |t|, and the re-measure's when it crossed. */
const aaCell = (r) => {
  const reading = aa.get(`${r.fixture}\t${r.fn}`)
  if (reading === undefined) {
    return ""
  }
  return reading.again === null
    ? reading.max.toFixed(2)
    : `**${reading.max.toFixed(2)}**, again ${reading.again.toFixed(2)}`
}
for (const r of rows) {
  let verdict = "ok"
  if (r.control) {
    verdict = r.max > THRESHOLD ? "control: differs, as it must" : "**control did not differ**"
  } else if (r.again !== null) {
    verdict = r.again > THRESHOLD ? "**differs**, and again on a fresh seed" : "crossed once, did not repeat"
  }
  console.log(
    `| ${r.fixture} | ${r.fn} | ${r.batch} | ${r.max.toFixed(2)} | ${r.test} | ${r.used} | ${r.raw} | ${r.again === null ? "" : r.again.toFixed(2)} | ${verdict} |${aaColumn ? ` ${aaCell(r)} |` : ""}`
  )
}
const checked = rows.filter((r) => !r.control)
const once = checked.filter((r) => r.again !== null)
const over = once.filter((r) => r.again > THRESHOLD)
const quiet = rows.filter((r) => r.control && r.max <= THRESHOLD)
const crossedOnce =
  once.length === over.length
    ? ""
    : `; crossed once and not again: ${once
        .filter((r) => r.again <= THRESHOLD)
        .map((r) => r.fn)
        .join(", ")}`
console.log("")
if (nullRun) {
  // The A/A run measures the tests' false positives, so it has no control to require and no finding to fail on.
  console.log(
    `ct-timing: the A/A run: ${once.length} of ${checked.length} functions above |t| = ${THRESHOLD}, ${over.length} of them again on a fresh seed`
  )
  process.exit(0)
}
// Printed before the controls are judged, so a run that fails on them still says what its null read.
const aaOver = [...aa.values()].filter((r) => r.max > THRESHOLD)
const aaAgain = aaOver.filter((r) => r.again > THRESHOLD)
if (aa.size > 0) {
  console.log(
    `ct-timing: the same-runner A/A pass: ${aaOver.length} of ${aa.size} functions above |t| = ${THRESHOLD}${aaOver.length === 0 ? "" : ` (${aaOver.map((r) => r.fn).join(", ")})`}, ${aaAgain.length} of them again on a fresh seed`
  )
}
if (!rows.some((r) => r.control && !r.domainControl)) {
  fail("no `expect=branch` function was timed, so nothing shows this run could see a leak")
}
if (quiet.length > 0) {
  fail(
    `the control ${quiet.map((r) => r.fn).join(", ")} did not differ (|t| <= ${THRESHOLD}): a run that cannot see a leak written to be seen proves nothing about the others`
  )
}
// A function the timing pass flagged that this machine's null also crossed: said, and never read as a pass.
const alsoNull = once.filter((r) => aaOver.some((n) => n.fixture === r.fixture && n.fn === r.fn))
const alsoNullNote =
  alsoNull.length === 0
    ? ""
    : `; the same-runner A/A pass crossed on ${alsoNull.map((r) => r.fn).join(", ")} too, so this machine's noise reaches the same function: re-run before reading it as a leak`
console.log(
  over.length === 0
    ? `ct-timing: ${checked.length} functions, none above |t| = ${THRESHOLD} twice${crossedOnce}; the control differed${alsoNullNote}`
    : `ct-timing: ${over.length} of ${checked.length} functions above |t| = ${THRESHOLD} on two seeds: ${over.map((r) => r.fn).join(", ")}${crossedOnce}${alsoNullNote}`
)
// The A/A pass reports and never decides: the exit code is the timing pass's alone.
process.exit(over.length === 0 ? 0 : 1)
