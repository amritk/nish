// A guard on a folded module constant orders an index against it (#2316),
// but only as far as the guard says. `i <= SLOTS` lets `i` reach 4, the
// storage's length, one past its last slot, so `BOX[i]` stays unproven and is
// refused in `main.ts`, which `noPanic` lists: reading `SLOTS` as the bound
// of a `<` would let `at(4)` write past the end.
const SLOTS: i32 = 4
const BOX = new Int32Array(SLOTS)

const at = (i: i32): void => {
  if (i >= 0 && i <= SLOTS) {
    BOX[i] = 1
  }
}

export const main = (): i32 => {
  at(parseInt("4"))
  return BOX[0]
}
