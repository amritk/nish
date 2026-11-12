// A nullable reference narrowed and passed for an inline function parameter.
// `null` is tag 0, `h !== null` compares the tag with 0, and `apply(h, x)`
// passes an arrow that calls `h`, so `apply` is instantiated for the call and
// calls through the dispatcher of `h`'s place.
type Op = (x: i32) => i32

const double = (x: i32): i32 => x * 2
const negate = (x: i32): i32 => 0 - x

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

const pick = (k: i32): Op | null => {
  if (k === 0) {
    return null
  }
  return k === 1 ? double : negate
}

export const run = (k: i32, x: i32): i32 => {
  const h = pick(k)
  if (h !== null) {
    return apply(h, x)
  }
  return -1
}
