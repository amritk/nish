// An element access whose index the prover proves in range is marked proven
// too, but that proof says nothing about the string the element holds: the
// call keeps its `ffi-nul` site.
declare function strlen(s: string): i64

export const first = (names: string[]): i64 => {
  if (names.length > 0) {
    return strlen(names[0])
  }
  return -1
}

export const main = (): i32 => {
  return toI32(first(["ab", "cde"]))
}
