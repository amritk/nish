// `nish:simd` vectors in an object and in an array (docs/LANGUAGE.md,
// "`nish:simd`: sixteen-byte vectors"). tests/layout/simd.c declares the same
// object with clang's `__attribute__((vector_size(16)))` types, asserts its
// size and offsets, and reads every lane through the pointer `makeLanes`
// hands back, so a vector field sits at a sixteen-byte boundary and an array
// of vectors has a sixteen-byte stride, as C lays them out. `Mid` and `Tail`
// hold an inline array of vectors after a lone `i32`, in the middle of the
// object and as its last field: the array's header rounds up to sixteen and
// so does the object's size, the size the IR allocates.
import { f32x4, f64x2, i32x4, u16x8, u32x4, u8x16, splatU8x16, store } from "nish:simd";

class Lanes {
  tag: i32;
  v: i32x4;
  d: f64;
  w: f64x2;
  vs: i32x4[];
  b: u8x16;
  h: u16x8;
  u: u32x4;
  f: f32x4;

  constructor() {
    this.tag = 7;
    this.v = i32x4(1, 2, 3, 4);
    this.d = 0.5;
    this.w = f64x2(1.5, -2.5);
    this.vs = [i32x4(10, 11, 12, 13), i32x4(20, 21, 22, 23), i32x4(30, 31, 32, 33)];
    this.b = splatU8x16(9);
    this.h = u16x8(1, 2, 3, 4, 5, 6, 7, 65535);
    this.u = u32x4(1, 2, 3, 4294967295);
    this.f = f32x4(0.5, -1.5, 2.25, 0.1);
  }
}

class Mid {
  n: i32;
  vs: u32x4[];
  k: i32;

  constructor() {
    this.n = 3;
    this.vs = [u32x4(1, 2, 3, 4), u32x4(5, 6, 7, 8)];
    this.k = 9;
  }
}

class Tail {
  n: i32;
  vs: f32x4[];

  constructor() {
    this.n = 5;
    this.vs = [f32x4(1, 2, 3, 4), f32x4(5, 6, 7, 8), f32x4(9, 10, 11, 12)];
  }
}

export const makeLanes = (): Lanes => new Lanes();
export const makeMid = (): Mid => new Mid();
export const makeTail = (): Tail => new Tail();

// The bytes a `store` writes are the sixteen elements the index names, in order.
export const storeBytes = (): u8[] => {
  const xs: u8[] = new Array<u8>(20);
  store(u8x16(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16), xs, 2);
  return xs;
};
