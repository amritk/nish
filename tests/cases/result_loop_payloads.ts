// A `Result` answered in a register is boxed by the caller, inside the pass,
// and must outlive the pass's rewind when the pass stores it into an outer
// `let`: its `Ok` payload after a `while`, its `Err` payload after a nested
// `for`. The strings built after each loop reuse the arena the pass rewound.
const pick = (i: i32, j: i32): Result<i32, i32> => {
  if (j < 2) {
    return Ok(i * 10 + j)
  }
  return Err(-i)
}

export const main = (): i32 => {
  let ok = pick(0, 0)
  let n = 0
  while (ok.isOk() && n < 3) {
    ok = pick(n, 1)
    n += 1
  }
  console.log(`after while: ${n}`)
  if (ok.isOk()) {
    console.log(`ok ${ok.value}`)
  }
  let err = pick(0, 0)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (err.isOk() || err.isErr()) {
        err = pick(i, j)
      }
    }
  }
  console.log(`after for: ${err.isErr()}`)
  if (err.isErr()) {
    console.log(`err ${err.error}`)
  }
  return 0
}
