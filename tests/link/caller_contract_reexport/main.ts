// No root program re-exports a std caller contract to a host
// (docs/LANGUAGE.md, "Panic sites"): `routerDecode` is held when every call
// into it is proven, and a host calling it by a root symbol would make a
// call none is, but `export { ... } from` is refused, so a root reaches a
// host only through a function it declares, which is judged as any root
// export is (`caller_contract_exported_forward`).
import { routerDecode } from "nish/net/router"
export { routerDecode } from "nish/net/router"
import { done } from "./done"

export const main = (): i32 => {
  const t: u8[] = [47, 97, 98]
  const out: u8[] = [0, 0, 0]
  console.log(`${routerDecode(t, 0, toI32(t.length), out)}`)
  console.log(done())
  return 0
}
