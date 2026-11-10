// A `Result` answered in a register is boxed by the caller, in the block's
// arena. Storing it into a `let` declared outside a `using a = arena()` block
// would keep it past the block's release (#899), so the block is refused.
const pick = (i: i32): Result<i32, i32> => {
  if (i < 2) {
    return Ok(i)
  }
  return Err(-i)
}

export const main = (): i32 => {
  let r = pick(0)
  console.log(`${r.isOk()}`)
  {
    using a = arena()
    r = pick(5)
  }
  console.log(`${r.isErr()}`)
  return 0
}
