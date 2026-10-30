// The six vector types made with their type-named constructors and with
// `splat…`, read with `extract` and changed with `replace`. Each lane index is
// a constant, so each is one `extractelement` or `insertelement`.
import {
  u8x16,
  u16x8,
  i32x4,
  u32x4,
  f32x4,
  f64x2,
  splatU8x16,
  splatU16x8,
  splatI32x4,
  splatU32x4,
  splatF32x4,
  splatF64x2,
  extract,
  replace,
} from "nish:simd";

export const main = (): number => {
  const b = u8x16(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 255);
  console.log(extract(b, 0) + extract(b, 15));
  const h = replace(u16x8(1, 2, 3, 4, 5, 6, 7, 8), 7, 65535);
  console.log(extract(h, 7));
  const w = i32x4(-1, 2, -3, 4);
  console.log(extract(w, 2));
  const u = u32x4(1, 2, 3, 4000000000);
  console.log(extract(u, 3));
  const f = replace(f32x4(1.5, 2.5, 3.5, 4.5), 0, 0.5);
  console.log(extract(f, 0) + extract(f, 3));
  const d = f64x2(0.25, 0.125);
  console.log(extract(d, 1));
  console.log(extract(splatU8x16(200), 9));
  console.log(extract(splatU16x8(300), 5));
  console.log(extract(splatI32x4(-7), 3));
  console.log(extract(splatU32x4(7), 0));
  console.log(extract(splatF32x4(2.5), 1));
  console.log(extract(splatF64x2(-0.5), 0));
  return 0;
};
