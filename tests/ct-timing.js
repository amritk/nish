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
 *
 * It prints a Markdown table and exits 1 when any function's largest |t| is
 * above 4.5, 2 when it could not run or a control did not differ, and 0
 * otherwise. It
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

const rows = []
for (const file of fixtures) {
  const name = file.slice(0, -".ts".length)
  const all = ctSpecs(fs.readFileSync(path.join(casesDir, file), "utf8"))
  const broken = all.filter((spec) => spec.problems.length > 0)
  if (broken.length > 0) {
    fail(`${name}: ${broken.map((spec) => `${spec.name}: ${spec.problems.join("; ")}`).join("\n")}`)
  }
  const specs = all.filter((spec) => spec.expect === null || spec.expect === "branch")
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
  const driver = driverFor(specs, DOMAINS[file])
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
  const run = spawnSync(exe, [String(samples), String(seed)], { encoding: "utf8", maxBuffer: 1 << 24 })
  if (run.status !== 0) {
    fail(`${name} exited ${run.status}:\n${run.stderr}`)
  }
  const controls = new Set(specs.filter((spec) => spec.expect !== null).map((spec) => spec.name))
  const domainControlNames = new Set(driver.controls)
  for (const line of run.stdout.trim().split("\n")) {
    const [fn, batch, max, test, used, raw] = line.split("\t")
    // A domain's controls must differ like the others, but only an `expect=branch` function is the run's control.
    const domainControl = domainControlNames.has(fn)
    rows.push({
      fixture: name,
      fn,
      batch,
      max: Number(max),
      test,
      used,
      raw,
      control: controls.has(fn) || domainControl,
      domainControl,
    })
  }
}

console.log(
  `ct-timing: ${os.arch()}, ${os.cpus()[0]?.model.trim() ?? "unknown CPU"}; ${samples} measurements a function, seed ${seed}; threshold |t| > ${THRESHOLD}`
)
console.log("")
console.log("| fixture | function | batch | max \\|t\\| | from test | per class | uncropped t | verdict |")
console.log("| --- | --- | ---: | ---: | --- | ---: | ---: | --- |")
for (const r of rows) {
  const differs = r.max > THRESHOLD
  let verdict = differs ? "**differs**" : "ok"
  if (r.control) {
    verdict = differs ? "control: differs, as it must" : "**control did not differ**"
  }
  console.log(
    `| ${r.fixture} | ${r.fn} | ${r.batch} | ${r.max.toFixed(2)} | ${r.test} | ${r.used} | ${r.raw} | ${verdict} |`
  )
}
const checked = rows.filter((r) => !r.control)
const over = checked.filter((r) => r.max > THRESHOLD)
const quiet = rows.filter((r) => r.control && r.max <= THRESHOLD)
console.log("")
if (!rows.some((r) => r.control && !r.domainControl)) {
  fail("no `expect=branch` function was timed, so nothing shows this run could see a leak")
}
if (quiet.length > 0) {
  fail(
    `the control ${quiet.map((r) => r.fn).join(", ")} did not differ (|t| <= ${THRESHOLD}): a run that cannot see a leak written to be seen proves nothing about the others`
  )
}
console.log(
  over.length === 0
    ? `ct-timing: ${checked.length} functions, none above |t| = ${THRESHOLD}; the control differed`
    : `ct-timing: ${over.length} of ${checked.length} functions above |t| = ${THRESHOLD}: ${over.map((r) => r.fn).join(", ")}`
)
process.exit(over.length === 0 ? 0 : 1)
