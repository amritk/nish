// Facts a caller proves about an argument prove the callee's arithmetic
// (src/ranges.ts): `cell` is only called with row and column below 8, so
// `row * 8 + col` fits, and `place` is entered with `c` from 0 up to 7 —
// `place(c + 1)` is reached only past `c === 7` — so `c + 1` and `c * c`
// need no overflow check.
const cell = (row: i32, col: i32): i32 => row * 8 + col;

const place = (c: i32): i32 => {
  if (c === 7) {
    return cell(c, c);
  }
  return c * c + place(c + 1);
};

export const test = (): number => place(0) + cell(3, 4);
