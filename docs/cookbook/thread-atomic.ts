import { AtomicI32, AtomicI64 } from "nish/threads"

export const tally = (hits: AtomicI32, peak: AtomicI64, k: i32, v: i64): i32 => {
  const before = hits.add(k)
  peak.max(v)
  hits.compareExchange(before + k, 0)
  return hits.load()
}
