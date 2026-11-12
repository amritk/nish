// S6, shape 3: a call chain 32 frames deep whose bottom frame fails on every
// call. `descend` calls itself 32 times and each frame has work left after the
// call below it returns, so no frame is a tail call and a failure passes
// through all 32 on its way to the loop that handles it. `descend` only ever
// sees a 16-bit `x`, so the bottom frame's success arm is the dead one here.
//
// This is the program the desugaring would produce from
//
//   const descend = (d: i32, x: i32): i32 => {
//     if (d === 0) {
//       if (x >= 0) { throw x & 0xff }
//       return 1
//     }
//     return (descend(d - 1, x ^ d) + d) & 0xffff
//   }
//   export const deep = (n: i32, seed: i32): i32 => {
//     let acc = seed & 0xffff
//     for (let i = 0; i < n; i++) {
//       try { acc = (acc ^ descend(32, (acc + (i & 0xff)) & 0xffff)) & 0xffff }
//       catch (e) { acc = (acc + e + 1) & 0xffff }
//     }
//     return acc
//   }
//
// What is thrown feeds the next call's input, so the loop carries a
// dependency. deep.ll is the same program on landing pads.
const descend = (d: i32, x: i32): Result<i32, i32> => {
  if (d === 0) {
    if (x >= 0) {
      return Err(x & 0xff)
    }
    return Ok(1)
  }
  const below = descend(d - 1, x ^ d).orReturn()
  return Ok((below + d) & 0xffff)
}

export const deep = (n: i32, seed: i32): i32 => {
  let acc: i32 = seed & 0xffff
  for (let i: i32 = 0; i < n; i++) {
    const r = descend(32, (acc + (i & 0xff)) & 0xffff)
    if (r.isErr()) {
      acc = (acc + r.error + 1) & 0xffff
      continue
    }
    acc = (acc ^ r.value) & 0xffff
  }
  return acc
}
