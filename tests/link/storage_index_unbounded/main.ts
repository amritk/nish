// An index into module storage is proven only by a bound a local array's
// index would need (#2316). `i <= BOX.length` lets `i` reach the length
// itself, one past the last slot, so `BOX[i]` stays unproven and is refused
// in `main.ts`, which `noPanic` lists: proving it from the storage's folded
// length alone, whatever the guard, would let `at(4)` write past the end.
const BOX = new Int32Array(4)

const at = (i: i32): void => {
  if (i >= 0 && i <= BOX.length) {
    BOX[i] = 1
  }
}

export const main = (): i32 => {
  at(parseInt("4"))
  return BOX[0]
}
