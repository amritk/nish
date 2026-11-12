// S6's driver, shared by both lowerings: `main <shape> <n> <seed> <k>` runs
// one kernel, prints its checksum on stdout and the nanoseconds the call took
// on stderr. `k` is the shape's own knob: how many records to a bad one for
// `parse` (0 for none), how many frames for `deep`, unused by `hot`. The `Result` build links this module with hot.ts, parse.ts and
// deep.ts as compiled; the landing-pad build links the same main.ll with
// hot.ll, parse.ll and deep.ll, which define the same three symbols.
import { deep } from "./deep"
import { hot } from "./hot"
import { parse } from "./parse"

export const main = (): i32 => {
  if (process.argv.length < 5) {
    console.error("usage: main hot|parse|deep <n> <seed> <k>")
    return 2
  }
  const shape = process.argv[1]
  const n = toI32(Number(process.argv[2]))
  const seed = toI32(Number(process.argv[3]))
  const k = toI32(Number(process.argv[4]))
  const t0: i64 = monotonicNanos()
  let sum: i32 = 0
  if (shape === "hot") {
    sum = hot(n, seed)
  } else if (shape === "parse") {
    sum = parse(n, seed, k)
  } else if (shape === "deep") {
    sum = deep(n, seed, k)
  } else {
    console.error(`unknown shape ${shape}`)
    return 2
  }
  const t1: i64 = monotonicNanos()
  console.log(`${sum}`)
  console.error(`ns ${t1 - t0}`)
  return 0
}
