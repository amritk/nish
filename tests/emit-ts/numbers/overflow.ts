// An i32 addition that overflows panics under Node as it does natively: the
// same message on stderr, exit 1, and nothing printed after it.
const add = (a: i32, b: i32): i32 => a + b

export const main = (): i32 => {
  console.log(add(1, 2))
  console.log(add(2147483647, 1))
  console.log("unreachable")
  return 0
}
