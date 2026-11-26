// A `pop()` the length guard proves non-empty is marked proven too, but that
// proof says nothing about the string it answers: the call keeps its
// `ffi-nul` site.
declare function strlen(s: string): i64

export const last = (names: string[]): i64 => {
  if (names.length > 0) {
    return strlen(names.pop())
  }
  return -1
}

export const main = (): i32 => {
  return toI32(last(["ab", "cde"]))
}
