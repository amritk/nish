// `indexOf(...) >= 1` leaves a NUL at index 0 possible.
declare function strlen(s: string): i64

export const measure = (s: string): i64 => {
  if (s.indexOf("\u0000") >= 1) {
    return -1
  }
  return strlen(s)
}

export const main = (): i32 => {
  return toI32(measure("abc"))
}
