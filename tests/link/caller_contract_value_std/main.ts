// A std caller contract taken as a value: `routerDecode` leads with
// `if (start < 0 || end < 0 || end < start || end > toI32(target.length))
// { panic(...) }`, and `main.ts` hands it to `apply`, so it is a member of
// a dispatcher this module makes and takes `hidden` linkage
// (docs/LANGUAGE.md, "Panic sites"). The dispatcher's call holds no
// caller's test, so the guard's `panic` stays `routerDecode`'s and every
// call reaches it: `--deny-panics` refuses `main`'s direct call too,
// though its range is proven.
import { routerDecode } from "nish/net/router"
import { done } from "./done"

const apply = (f: (target: u8[], start: i32, end: i32, out: u8[]) => i32, end: i32): i32 => {
  const t: u8[] = [47, 97, 98]
  const out: u8[] = [0, 0, 0]
  return f(t, 0, end, out)
}

export const main = (): i32 => {
  const t: u8[] = [47, 97, 98]
  const out: u8[] = [0, 0, 0]
  console.log(`${routerDecode(t, 0, toI32(t.length), out)} ${apply(routerDecode, 9)}`)
  console.log(done())
  return 0
}
