// A forward a host may call: `grid` passes its own `width` and `height`
// into `area`'s contract (docs/LANGUAGE.md, "Panic sites"), and `grid` is
// exported from the root package, so a host calls it with any size. Its
// forward is never held, so `area`'s `panic` stays its own though `main`'s
// calls are proven, and `--deny-panics` refuses it.
// `caller_contract_forward` is the same forward, unexported, held.
import { done } from "./done"

const area = (who: string, width: i32, height: i32): i32 => {
  if (width < 0 || height < 0 || toI64(width) * toI64(height) > toI64(2147483647)) {
    panic(`${who}: the area does not fit i32`)
  }
  return toI32(toI64(width) * toI64(height))
}

export const grid = (width: i32, height: i32): i32 => {
  const cells: i32 = area("grid", width, height)
  return cells
}

export const main = (): i32 => {
  console.log(`${grid(4, 5)} ${area("main", 2, 3)}`)
  console.log(done())
  return 0
}
