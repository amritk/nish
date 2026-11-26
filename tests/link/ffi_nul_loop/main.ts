// A loop's back edge brings in a string the check never saw: the first pass
// checks `u`, then assigns `t` to it, so the second pass's call is refused.
declare function strlen(s: string): i64

export const measure = (s: string, t: string): i64 => {
  let u = s
  let last: i64 = 0
  for (let i = 0; i < 2; i++) {
    if (i === 0) {
      if (u.indexOf("\u0000") >= 0) {
        return -1
      }
    }
    last = strlen(u)
    u = t
  }
  return last
}

export const main = (): i32 => {
  return toI32(measure("abc", "de"))
}
