// examples-strict S1 (#2316): an index into module storage is proven the way
// an index into a local array is. A storage's length is folded at compile time
// and it never resizes, so a constant index below it, a loop below its
// `.length` or below the constant it was made with, and a guard on its
// `.length` all hold under --deny-panics, and the IR keeps no bounds check.
const SLOTS: i32 = 4

const BOX = new Int32Array(SLOTS)
const MARKS = new Array<u8>(3)

const at = (i: i32): i32 => {
  if (i >= 0 && i < BOX.length) {
    return BOX[i]
  }
  return -1
}

export const main = (): void => {
  BOX[0] = 10
  BOX[3] = 13
  MARKS[2] = 7
  for (let i = 0; i < BOX.length; i++) {
    BOX[i] = i
  }
  for (let i = 0; i < SLOTS; i++) {
    BOX[i] = SLOTS - i
  }
  for (let i = 0; i < MARKS.length; i++) {
    MARKS[i] = 1
  }
  console.log(`${BOX[0]} ${BOX[3]} ${at(1)} ${at(4)} ${MARKS[2]}`)
}
