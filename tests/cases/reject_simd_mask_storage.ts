// A mask is a value held in a local, a parameter or a return of a function
// the module keeps: it has no layout an array, a field, a `Result`, a type
// argument, a method or an exported signature could describe (the type argument and
// the array literal a body holds are `reject_simd_mask_in_body`). What is
// stored is the vectors it selects or its `bitmask`.
import { i32x4, mask32x4, eq } from "nish:simd";

class Holder {
  m: mask32x4;
  constructor() {
    this.m = eq(i32x4(1, 2, 3, 4), i32x4(1, 2, 3, 4));
  }
}

class Taker {
  n: i32;
  constructor(m: mask32x4) {
    this.n = 0;
  }
}

export const f = (a: i32x4): mask32x4 => eq(a, a);
export const g = (m: mask32x4): i32 => 0;
const h = (a: i32x4): mask32x4[] => [eq(a, a)];
const j = (a: i32x4): Result<mask32x4, string> => ok(eq(a, a));

export const main = (): number => {
  const a = i32x4(1, 2, 3, 4);
  const holder = new Holder();
  const taker = new Taker(eq(a, a));
  console.log(`${h(a).length} ${taker.n}`);
  const r = j(a);
  return 0;
};
