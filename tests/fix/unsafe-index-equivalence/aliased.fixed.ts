// Both names already imported under aliases: the rewrites call them by those
// and the fix adds no import.
import { uncheckedGet as get, uncheckedSet as put } from "nish:unsafe"

export const tally = (counts: i32[], k: i32): i32 => {
  put(counts, k, get(counts, k) * 3)
  put(counts, k + 1, get(counts, k) - 1)
  return get(counts, k) + get(counts, k + 1)
}
