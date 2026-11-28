// A storage's `.length` bounds an index from above only (#2316). With no
// `i >= 0` beside `i < BOX.length`, a negative `i32` passes the guard, so
// `BOX[i]` stays unproven and is refused in `main.ts`, which `noPanic` lists:
// proving it from the length alone would let `at(-1)` write before the start.
const BOX = new Int32Array(4)

const at = (i: i32): void => {
  if (i < BOX.length) {
    BOX[i] = 1
  }
}

export const main = (): i32 => {
  at(parseInt("-1"))
  return BOX[0]
}
