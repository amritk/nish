// `nish:simd` vectors in an object and in an array (docs/LANGUAGE.md,
// "`nish:simd`: sixteen-byte vectors"). tests/layout/simd.c declares the same
// object with clang's `__attribute__((vector_size(16)))` types, asserts its
// size and offsets, and reads every lane through the pointer `makeLanes`
// hands back, so a vector field sits at a sixteen-byte boundary and an array
// of vectors has a sixteen-byte stride, as C lays them out.
import { f64x2, i32x4, u8x16, splatU8x16, store } from "nish:simd";

class Lanes {
  tag: i32;
  v: i32x4;
  d: f64;
  w: f64x2;
  vs: i32x4[];
  b: u8x16;

  constructor() {
    this.tag = 7;
    this.v = i32x4(1, 2, 3, 4);
    this.d = 0.5;
    this.w = f64x2(1.5, -2.5);
    this.vs = [i32x4(10, 11, 12, 13), i32x4(20, 21, 22, 23), i32x4(30, 31, 32, 33)];
    this.b = splatU8x16(9);
  }
}

export const makeLanes = (): Lanes => new Lanes();

// The bytes a `store` writes are the sixteen elements the index names, in order.
export const storeBytes = (): u8[] => {
  const xs: u8[] = new Array<u8>(20);
  store(u8x16(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16), xs, 2);
  return xs;
};
