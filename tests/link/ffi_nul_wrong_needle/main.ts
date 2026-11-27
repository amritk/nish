// A search for another character says nothing about NUL.
declare function strlen(s: string): i64

export const measure = (s: string): i64 => {
  if (s.indexOf("x") >= 0) {
    return -1
  }
  return strlen(s)
}

export const main = (): i32 => {
  return toI32(measure("abc"))
}
