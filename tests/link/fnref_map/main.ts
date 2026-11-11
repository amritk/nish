// WP51 stage 1: a reference read back out of a `Map` is `Op | undefined`,
// and `Map.get` has no return place the pass can follow, so the place the
// value reaches is wide: every function of its signature. Narrowed or
// defaulted with `??`, the call dispatches on the stored function's tag.
import { big, inc, Op, run } from "./ops.ts"

export const main = (): void => {
  const m = new Map<string, Op>()
  m.set("big", big)
  const got = m.get("big")
  let a = 0
  if (got !== undefined) {
    a = got(1)
  }
  const h = m.get("big") ?? inc
  const g = m.get("none") ?? inc
  console.log(`${a} ${h(0)} ${h === big} ${run(g, 0)}`)
}
