/**
 * The ceiling for a bcrypt cost loop on this core: hand-written x86-64 bodies
 * (kernel/gen.mjs: every lane's L and R in a register, no spills) at five and
 * six lanes, in four ways of taking the bytes of a word (`base-shr`,
 * `base-ah`, `rorx-shr`, `rorx-ah`; the last two need BMI2), and the same
 * interleave in C under `cc -O2` (kernel/harness.c's `C_BODY`), against
 * `bcryptHashN` at the same widths. It answers whether a BMI2 kernel in the
 * runtime would pay: the row to beat is Nish's best width.
 *
 * Each kernel is first run three bodies on a random state and compared word
 * for word with a plain C Blowfish; one that differs is not timed and the
 * script exits 1. The kernels then run the bodies of `--hashes` cost-`--cost`
 * hashes on each lane, `(2^(cost+1) + 1)` bodies a hash, which leaves out the
 * 192 blocks of the magic string and the key mixing (under 0.1% of a hash at
 * cost 10); their ms per hash is that CPU time over hashes × lanes, beside
 * Nish's whole hashes. Everything runs in interleaved rounds (common.mjs),
 * and a row is the median and spread of `--rounds`.
 *
 * Usage: node bench/crypto/bcrypt/ceiling.mjs [--compiler <nish>] [--hashes N] [--rounds N] [--cost N]
 * Off x86-64, or on a CPU whose /proc/cpuinfo lists no bmi2, it prints why and
 * exits 0 without timing. Build products go to build/bench/bcrypt/ceiling/.
 */
import fs from "node:fs"
import path from "node:path"
import { kernel, VARIANTS } from "./kernel/gen.mjs"
import { argValue, band, buildNish, intArg, median, nishLoopN, root, run, timeRounds } from "./common.mjs"

const compiler = argValue("--compiler", path.join(root, "build", "nish"))
const hashes = intArg("--hashes", 4, 1, 1e6)
const rounds = intArg("--rounds", 5, 1, 1e3)
const cost = intArg("--cost", 10, 4, 31)
const widths = [5, 6]

const cpuinfo = fs.existsSync("/proc/cpuinfo") ? fs.readFileSync("/proc/cpuinfo", "utf8") : ""
const skip = (why) => {
  console.log(`ceiling: skipped, ${why}`)
  process.exit(0)
}
if (process.arch !== "x64") {
  skip(`the kernels are x86-64 and this host is ${process.arch}`)
}
if (!/^flags\s*:.*\bbmi2\b/m.test(cpuinfo)) {
  skip("this CPU lists no bmi2 in /proc/cpuinfo (or there is none to read)")
}
const cc = process.env.CC || "cc"
if (run(cc, ["--version"]).status !== 0) {
  skip(`no C compiler (${cc}) to build the harness`)
}
const model = (cpuinfo.match(/^model name\s*:\s*(.+)$/m) ?? [])[1] ?? "unknown"

const dir = path.join(root, "build", "bench", "bcrypt", "ceiling")
fs.mkdirSync(dir, { recursive: true })
const harness = path.join(import.meta.dirname, "kernel", "harness.c")

const programs = []
for (const w of widths) {
  const exe = buildNish(compiler, dir, `nishn${w}`, nishLoopN(w, hashes, cost))
  programs.push({ name: `Nish \`bcryptHashN\`, ${w} lanes`, nish: true, w, argv: [exe], scale: 1000 / (hashes * w) })
}
for (const w of widths) {
  for (const v of [...VARIANTS, "c"]) {
    const exe = path.join(dir, `kernel${w}-${v}`)
    const sources = [harness]
    const flags = ["-O2", `-DW=${w}`]
    if (v === "c") {
      flags.push("-DC_BODY")
    } else {
      fs.writeFileSync(`${exe}.s`, kernel(w, v))
      sources.push(`${exe}.s`)
    }
    const built = run(cc, [...flags, ...sources, "-o", exe])
    if (built.status !== 0) {
      console.error(`kernel ${w} ${v} did not build:\n${built.stderr}`)
      process.exit(1)
    }
    const checked = run(exe, ["check"])
    if (checked.status !== 0 || checked.stdout.trim() !== "ok") {
      console.error(`kernel ${w} ${v} disagrees with the reference, so it is not timed:\n${checked.stdout}${checked.stderr}`)
      process.exit(1)
    }
    const name = v === "c" ? `C interleave, \`${cc} -O2\`` : `hand \`${v}\``
    programs.push({ name, w, argv: [exe, "time", String(cost), String(hashes)], scale: 1000 / (hashes * w) })
  }
}

// Nish's runs print a hash a lane; every kernel of a width runs the same
// bodies on the same state, so prints the same checksum.
const sums = new Map()
const samples = timeRounds(programs, rounds, (p, stdout) => {
  if (p.nish) {
    if (stdout.trim().split("\n").length !== p.w) {
      console.error(`${p.name} did not print a hash a lane`)
      process.exit(1)
    }
    return
  }
  const sum = stdout.trim()
  if ((sums.get(p.w) ?? sum) !== sum) {
    console.error(`${p.name} ended on checksum ${sum}, another ${p.w}-lane kernel on ${sums.get(p.w)}`)
    process.exit(1)
  }
  sums.set(p.w, sum)
})

const best = Math.min(...programs.flatMap((p, i) => (p.nish ? [median(samples[i])] : [])))
console.log(`${model}: CPU ms per cost-${cost} hash a lane (${hashes} hashes a round, median and spread of ${rounds} rounds)`)
console.log("A kernel's row is its cost-loop bodies only; Nish's is whole hashes.\n")
console.log("| Lanes | Body | ms per hash | Nish's best / this |")
console.log("| ---: | --- | ---: | ---: |")
programs.forEach((p, i) => {
  console.log(`| ${p.w} | ${p.name} | ${band(samples[i])} | ${(best / median(samples[i])).toFixed(3)} |`)
})
