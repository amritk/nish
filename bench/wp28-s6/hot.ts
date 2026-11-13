// S6, shape 1: a hot loop whose fallible callee never fails. `step` refuses a
// negative input and `hot` only ever hands it a 16-bit one, so the error arm
// is dead at run time and what is timed is the happy path alone: the call,
// the `Result` it answers and the test of it.
//
// This is the program the desugaring would produce from
//
//   const step = (x: i32): i32 => {
//     if (x < 0) { throw x }
//     return ((x * 31) ^ (x >> 3)) & 0xffff
//   }
//   export const hot = (n: i32, seed: i32): i32 => {
//     let acc = seed & 0xffff
//     try {
//       for (let i = 0; i < n; i++) { acc = step((acc + (i & 0xff)) & 0xffff) }
//     } catch (e) { return -1 - e }
//     return acc
//   }
//
// The accumulator feeds the next input, so the loop carries a dependency and
// cannot be closed-formed. hot.ll is the same program on landing pads.
const step = (x: i32): Result<i32, i32> => {
  if (x < 0) {
    return Err(x)
  }
  return Ok(((x * 31) ^ (x >> 3)) & 0xffff)
}

export const hot = (n: i32, seed: i32): i32 => {
  let acc: i32 = seed & 0xffff
  for (let i: i32 = 0; i < n; i++) {
    const r = step((acc + (i & 0xff)) & 0xffff)
    if (r.isErr()) {
      return -1 - r.error
    }
    acc = r.value
  }
  return acc
}
