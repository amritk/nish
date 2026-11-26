// A reassignment after the check drops what the check proved.
declare function strlen(s: string): i64

export const measure = (s: string, t: string): i64 => {
  let u = s
  if (u.indexOf("\u0000") >= 0) {
    return -1
  }
  u = t
  return strlen(u)
}

export const main = (): i32 => {
  return toI32(measure("abc", "de"))
}
