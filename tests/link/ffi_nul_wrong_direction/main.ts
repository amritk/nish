// The branch where the search found a NUL proves nothing NUL-free.
declare function strlen(s: string): i64

export const measure = (s: string): i64 => {
  if (s.indexOf("\u0000") >= 0) {
    return strlen(s)
  }
  return -1
}

export const main = (): i32 => {
  return toI32(measure("abc"))
}
