// A caller contract a host may call: `cell` is exported from the root
// package, so a host calls it by its symbol with any index, and no call
// this program makes proves that one (docs/LANGUAGE.md, "Panic sites").
// `main`'s call is proven, yet `cell`'s `panic` stays its own and
// `--deny-panics` refuses it. `caller_contract_shapes` is the same
// guard, unexported, held.
import { done } from "./done"

export const cell = (xs: i32[], at: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    panic("cell: the index is outside the array")
  }
  return at
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  console.log(`${cell(xs, 2)}`)
  console.log(done())
  return 0
}
