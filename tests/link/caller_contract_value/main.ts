// A caller contract taken as a value: `apply` calls whatever function it
// is handed, with an index `cell`'s guard never sees, so no call names
// `cell` there (docs/LANGUAGE.md, "Panic sites"). `main`'s own call is
// proven, yet `cell`'s `panic` stays its own and `--deny-panics`
// refuses it.
import { done } from "./done"

const cell = (xs: i32[], at: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    panic("cell: the index is outside the array")
  }
  return at
}

const apply = (f: (xs: i32[], at: i32) => i32, at: i32): i32 => {
  const xs: i32[] = [1, 2, 3]
  return f(xs, at)
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  console.log(`${cell(xs, 2)} ${apply(cell, 1)}`)
  console.log(done())
  return 0
}
