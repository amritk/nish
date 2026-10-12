// How bench/run.mjs reads the table of Nish against its Rust and Go twins:
// where a ratio falls against its noise band, one run's verdict on one
// statistic, and what every run of a kernel says together. Kept apart from
// run.mjs so that tests/run.js can feed it fixed per-run results and check the
// words it prints without building or timing anything.
import fs from "node:fs"

/** How close to its band a ratio may fall and still be read as at the band's edge rather than past it. */
export const BAND_EDGE = 0.005

/** The 1.10x target a ratio is held to, whatever its band says. */
const TARGET = 1.1

/** Where a ratio falls against its band: "slower", "faster", "within", or "edge" when it clears the band by less than BAND_EDGE. */
export const sideOf = (quotient, band) => {
  const past = Math.abs(quotient - 1) - band
  if (past <= 0) {
    return "within"
  }
  if (past < BAND_EDGE) {
    return "edge"
  }
  return quotient > 1 ? "slower" : "faster"
}

/**
 * One run's verdict on one statistic (`min` or `median`): the fastest other
 * column on that statistic, Nish's value over its, and the band, which is the
 * larger of the two binaries' gaps to their byte-identical copies. `stats`
 * maps every id, and every id with `-copy` after it, to { min, median }.
 */
export const judge = (stats, ids, field) => {
  const fastest = ids
    .filter((id) => id !== "nish")
    .reduce((a, b) => (stats.get(b)[field] < stats.get(a)[field] ? b : a))
  const gap = (id) => Math.abs(stats.get(id)[field] / stats.get(`${id}-copy`)[field] - 1)
  const quotient = stats.get("nish")[field] / stats.get(fastest)[field]
  const band = Math.max(gap("nish"), gap(fastest))
  return { fastest, ratio: quotient, band, side: sideOf(quotient, band) }
}

/**
 * What every run of a kernel says on one statistic, together. The side of the
 * band the runs agree on, and in how many it held; runs on both sides of the
 * band make no claim. Then, whatever the band says: whether Nish came out
 * ahead in some runs and behind in others, and in how many runs the unrounded
 * ratio is past the 1.10x target, which a wide band does not excuse.
 */
export const readAcross = (verdicts) => {
  const n = verdicts.length
  const runs = n === 1 ? "the one run" : `all ${n} runs`
  const someOf = (k) => (k === n ? runs : `${k} of ${n} runs`)
  const tally = (side) => verdicts.filter((v) => v.side === side).length
  const slower = tally("slower")
  const faster = tally("faster")
  const edge = tally("edge")
  let text
  if (slower > 0 && faster > 0) {
    text = `noisy, machine-dependent; no claim (slower outside the band in ${someOf(slower)}, faster in ${someOf(faster)})`
  } else if (slower === 0 && faster === 0) {
    if (edge === n) {
      text = `at the band's edge in ${runs}`
    } else if (edge > 0) {
      text = `within the band in ${someOf(n - edge)}, at its edge in ${someOf(edge)}`
    } else {
      text = `within the band in ${runs}`
    }
  } else {
    const word = slower > 0 ? "slower" : "faster"
    const k = Math.max(slower, faster)
    text =
      k === n
        ? `${word} outside the band in ${runs}`
        : `${word} outside the band in ${someOf(k)}, within it or at its edge in the rest`
  }
  const ahead = verdicts.filter((v) => v.ratio < 1).length
  const behind = verdicts.filter((v) => v.ratio > 1).length
  if (ahead > 0 && behind > 0) {
    text = `${text}; Nish ahead in ${someOf(ahead)}, behind in ${someOf(behind)}`
  }
  const past = verdicts.filter((v) => v.ratio > TARGET).length
  if (past === 0) {
    return `${text}; within 1.10x in ${runs}`
  }
  return `${text}; **past 1.10x in ${someOf(past)}**`
}

/** A ratio as the twins' tables print it: three decimals, so that a reading made on the unrounded value never contradicts its figure. */
export const times3 = (n) => `${n.toFixed(3)}x`

/** The lowest and highest of a statistic's ratio over the runs, as the spread column prints them. */
export const spreadOf = (verdicts) => {
  const quotients = verdicts.map((v) => v.ratio)
  const lo = Math.min(...quotients)
  const hi = Math.max(...quotients)
  return lo === hi ? times3(lo) : `${times3(lo)} to ${times3(hi)}`
}

/**
 * The cgroup v2 CPU quota of this process and of every cgroup above it, as a
 * whole number of CPUs rounded up, and `n` when it is lower or there is none:
 * the walk `nish_cgroup_cpus` in runtime/runtime-parallel.c makes, from the
 * `0::` line of /proc/self/cgroup up to /sys/fs/cgroup, so that no twin is
 * handed more threads than Nish's runtime would take.
 */
export const cgroupCpus = (n) => {
  const read = (file) => {
    try {
      return fs.readFileSync(file, "utf8")
    } catch {
      return ""
    }
  }
  const line = read("/proc/self/cgroup")
    .split("\n")
    .find((l) => l.startsWith("0::/"))
  if (line === undefined) {
    return n
  }
  let cpus = n
  let dir = line.slice(3).replace(/\/+$/, "")
  for (;;) {
    const m = read(`/sys/fs/cgroup${dir}/cpu.max`).match(/^([1-9]\d*)\s+(\d+)/)
    if (m !== null && Number(m[2]) > 0) {
      cpus = Math.min(cpus, Math.ceil(Number(m[1]) / Number(m[2])))
    }
    if (dir === "") {
      return cpus
    }
    dir = dir.slice(0, dir.lastIndexOf("/"))
  }
}
