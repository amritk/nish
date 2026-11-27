// A string checked for NUL reaches a C function with no check left, so
// `--deny-panics` accepts both calls: the early return of `>= 0` and the
// then-branch of `< 0`.
declare function strlen(s: string): i64

export const measure = (s: string): i64 => {
  if (s.indexOf("\u0000") >= 0) {
    return -1
  }
  return strlen(s)
}

export const measureInside = (s: string): i64 => {
  if (s.indexOf("\u0000") < 0) {
    return strlen(s)
  }
  return -1
}
