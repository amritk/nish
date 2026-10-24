// An `orReturn` inside a `using a = arena()` block: the hoisted return stays
// inside the block, so JavaScript disposes `a` on that exit as on the block's
// end. Node cannot show the disposal: every value `using` takes — `arena()`,
// `scope()`, a `Mutex`'s `lock()` — disposes as a no-op there, and a program's
// own `[Symbol.dispose]` is refused (`reject_thread_dispose_elsewhere`), so this
// row pins the shape and the result, not the release. (`using s =
// scope()` is the same block to this row, but `nish/threads` imports
// `nish:unsafe`'s wrapping arithmetic, which the numbers row brings to Node.)
import { Result, Ok, Err, arena, checkedAdd } from "nish/runtime"
import type { i32 } from "nish/runtime"
const check = (ok: boolean): Result<i32, i32> => (ok ? Ok(3) : Err(-1))

const run = (ok: boolean): Result<i32, i32> => {
  let total: i32 = 0
  {
    using a = arena()
    const __t0 = check(ok);
    if (__t0.isErr()) return Err(__t0.error);
    const v = __t0.value
    const xs: i32[] = [v, v, v]
    for (const x of xs) {
      total = checkedAdd(total, x)
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
