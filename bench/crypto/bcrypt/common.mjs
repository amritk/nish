/**
 * What the bcrypt benchmarks share: the `bcryptHashN` program, building a
 * Nish program, and timing programs in interleaved rounds by the child's user
 * CPU time (bash's `time`), so a report is CPU, not wall, time. Round 0 warms
 * the page cache and the CPU's clocks and is not counted.
 *
 * A row gives two estimators: the median with its spread, and the fastest
 * round. On a shared host another tenant can only slow a CPU-bound round
 * (cache and port contention, a lower clock), never speed it up, so the
 * fastest round is the robust one and the ratios are taken on it; the median
 * stays beside it to show how noisy the host was.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export const root = path.resolve(import.meta.dirname, "..", "..", "..")
export const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts })

export const argValue = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : fallback
}

/** An integer flag from `lo` to `hi`, or exit 1 naming it. */
export const intArg = (name, fallback, lo, hi) => {
  const value = Number(argValue(name, String(fallback)))
  if (!Number.isInteger(value) || value < lo || value > hi) {
    console.error(`${name} must be an integer from ${lo} to ${hi}`)
    process.exit(1)
  }
  return value
}

/** Blowfish blocks a cost-`cost` hash encrypts: 2^cost key expansions of two, 521 blocks each, then 64 × 3 for the magic string. */
export const blocksPerHash = (cost) => 2 ** cost * 1042 + 713

/**
 * `bcryptHashN` from `from` with lanes 0 to `width` - 1 given "U*U" under an
 * all-zero salt, `hashes` times, printing each given lane's last hash.
 */
export const nishLoopN = (
  width,
  hashes,
  cost,
  from = "nish/crypto/bcrypt"
) => `import { bcryptHashN } from "${from}"
import { Secret, secret, wipe } from "nish:secret"

const given = (k: i32): Secret<u8[]> | null => {
  if (k >= ${width}) {
    return null
  }
  const raw: u8[] = [85, 42, 85]
  return secret(raw)
}

export const main = (): i32 => {
  const r0: u8[] = [85, 42, 85]
  const p0: Secret<u8[]> = secret(r0)
  const p1: Secret<u8[]> | null = given(1)
  const p2: Secret<u8[]> | null = given(2)
  const p3: Secret<u8[]> | null = given(3)
  const p4: Secret<u8[]> | null = given(4)
  const p5: Secret<u8[]> | null = given(5)
  const salts: u8[] = new Array<u8>(96)
  let last: string[] = []
  for (let i: i32 = 0; i < ${hashes}; i++) {
    const h: Result<string[], string> = bcryptHashN(p0, p1, p2, p3, p4, p5, salts, ${cost})
    if (h.isOk()) {
      last = h.value
    }
  }
  wipe(p0)
  if (p1 !== null) {
    wipe(p1)
  }
  if (p2 !== null) {
    wipe(p2)
  }
  if (p3 !== null) {
    wipe(p3)
  }
  if (p4 !== null) {
    wipe(p4)
  }
  if (p5 !== null) {
    wipe(p5)
  }
  for (const hash of last) {
    if (hash !== "") {
      console.log(hash)
    }
  }
  return 0
}
`

/** Writes `source` to `dir`/`exe`.ts and links `dir`/`exe` with `compiler`, passing `flags`; exits 1 if it does not build. */
export const buildNish = (compiler, dir, exe, source, flags = []) => {
  fs.writeFileSync(path.join(dir, `${exe}.ts`), source)
  const built = run(
    compiler,
    [path.join(dir, `${exe}.ts`), ...flags, "-o", `${dir}/${exe}-out/`, "--link", path.join(dir, exe)],
    { cwd: root }
  )
  if (built.status !== 0) {
    // A missing compiler leaves no stderr, only `error`; a stale one (the
    // seed, or a build older than std/crypto/bcrypt.ts) fails on what it
    // lacks. Either way the usual fix is a fresh build.
    const why = built.error === undefined ? built.stderr : `${compiler}: ${built.error.message}`
    console.error(
      `the Nish program ${exe}.ts did not build:\n${why}\n` +
        `if ${compiler} is missing or older than this checkout, run \`npm run build\` first, or pass --compiler <nish>`
    )
    process.exit(1)
  }
  return path.join(dir, exe)
}

/**
 * Runs each program's `argv` once a round for `rounds` counted rounds after a
 * warm-up, interleaved, and returns each one's samples of `scale` × its user
 * CPU seconds. `check(program, stdout)` sees every run's output and exits on
 * a wrong one.
 */
export const timeRounds = (programs, rounds, check) => {
  const samples = programs.map(() => [])
  for (let round = 0; round <= rounds; round++) {
    programs.forEach((p, i) => {
      const r = run("bash", ["-c", 'TIMEFORMAT=%3U; time "$@" > "$0.out"', p.argv[0], ...p.argv])
      if (r.status !== 0) {
        console.error(`${p.name} failed:\n${r.stderr}`)
        process.exit(1)
      }
      check(p, fs.readFileSync(`${p.argv[0]}.out`, "utf8"))
      const seconds = Number(r.stderr.trim())
      if (r.stderr.trim() === "" || !Number.isFinite(seconds)) {
        console.error(`${p.name}: no CPU time in bash's output: ${JSON.stringify(r.stderr)}`)
        process.exit(1)
      }
      if (round > 0) {
        samples[i].push(seconds * p.scale)
      }
    })
  }
  return samples
}

/** The middle round, or the mean of the two middle rounds for an even count. */
export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/** The fastest round: the estimator a shared host's interference cannot inflate. */
export const fastest = (xs) => Math.min(...xs)

/** "median (min–max)" to `digits` places. */
export const band = (xs, digits = 1) =>
  `${median(xs).toFixed(digits)} (${Math.min(...xs).toFixed(digits)}–${Math.max(...xs).toFixed(digits)})`
