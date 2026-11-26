// A string nothing checked may hold a NUL: the call keeps its check.
declare function strlen(s: string): i64

export const measure = (s: string): i64 => {
  return strlen(s)
}

export const main = (): i32 => {
  return toI32(measure("abc"))
}
