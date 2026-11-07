// Reads a cachegrind.out file into per-function totals.
//
// Returns { events, desc, totals, fns }: `events` names the columns (Ir, I1mr,
// ILmr, Dr, D1mr, DLmr, Dw, D1mw, DLmw with --cache-sim=yes), `totals` sums
// them, and `fns["file:function"]` sums each function's lines.
import fs from "node:fs"

export const parseCachegrind = (file) => {
  const fns = {}
  const desc = []
  let events = []
  let fl = ""
  let cur = null
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line === "") {
      continue
    }
    const c = line.charCodeAt(0)
    if (c >= 48 && c <= 57) {
      if (!cur) {
        continue
      }
      const f = line.split(" ")
      for (let i = 1; i < f.length; i++) {
        cur[i - 1] += Number(f[i])
      }
    } else if (line.startsWith("fn=")) {
      const key = `${fl}:${line.slice(3)}`
      cur = fns[key] ??= events.map(() => 0)
    } else if (line.startsWith("fl=")) {
      fl = line.slice(3)
    } else if (line.startsWith("events: ")) {
      events = line.slice(8).trim().split(/\s+/)
    } else if (line.startsWith("desc: ")) {
      desc.push(line.slice(6))
    }
  }
  const totals = events.map((_, i) => Object.values(fns).reduce((s, v) => s + v[i], 0))
  return { events, desc, totals, fns }
}

/** Instructions, D1 misses and last-level data misses from a row of `events`. */
export const pick = (events, v) => {
  const at = (n) => (events.includes(n) ? v[events.indexOf(n)] : 0)
  return { ir: at("Ir"), d1: at("D1mr") + at("D1mw"), ll: at("DLmr") + at("DLmw") }
}
