// An `orReturn` inside a `using a = arena()` block: the hoisted return leaves
// the block, which releases the arena as the block's end would. (`using s =
// scope()` is the same block to this row, but `nish/threads` imports
// `nish:unsafe`'s wrapping arithmetic, which the numbers row brings to Node.)
const check = (ok: boolean): Result<i32, i32> => (ok ? Ok(3) : Err(-1))

const run = (ok: boolean): Result<i32, i32> => {
  let total: i32 = 0
  {
    using a = arena()
    const v = check(ok).orReturn()
    const xs: i32[] = [v, v, v]
    for (const x of xs) {
      total = total + x
    }
  }
  return Ok(total)
}

export const main = (): number => {
  const r = run(true)
  console.log(r.isOk() ? `ok ${r.value}` : `err ${r.error}`)
  const e = run(false)
  console.log(e.isOk() ? `ok ${e.value}` : `err ${e.error}`)
  return 0
}
