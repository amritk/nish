// Float lane arithmetic on `f32x4` and `f64x2`: the four operators, `neg`,
// `abs`, `sqrt`, `min`/`max` (`llvm.minimum`/`llvm.maximum`, so -0 orders
// below +0 and a NaN lane answers NaN), the ordered `sum` from -0, the six
// compares, which answer masks (`ne` is the unordered one: a NaN lane differs
// from everything), and `select`. Results print as their bits so native,
// wasi and Node are held to the same bits: 0.1 rounded to f32, a negative
// zero, an infinity, the smallest subnormal. A NaN's bits are the target's,
// so a NaN result prints as `x !== x`.
import { f32x4, f64x2, splatF32x4, add, sub, mul, div, neg, abs, sqrt, min, max, sum, eq, ne, lt, le, gt, ge, select, any, all, bitmask, extract } from "nish:simd";

const bits4 = (v: f32x4): string =>
  `${f32ToBits(extract(v, 0))} ${f32ToBits(extract(v, 1))} ${f32ToBits(extract(v, 2))} ${f32ToBits(extract(v, 3))}`;

const bits2 = (v: f64x2): string => `${f64ToBits(extract(v, 0))} ${f64ToBits(extract(v, 1))}`;

export const main = (): number => {
  const zero32: f32 = 0;
  const nan32 = toF32(parseFloat("NaN"));
  const tiny: f32 = toF32(1.0e-45);
  const a = f32x4(0.1, 1.5, -2.25, 3);
  const b = f32x4(0.2, -0.5, 4, 0);
  console.log(bits4(add(a, b)));
  console.log(bits4(sub(a, b)));
  console.log(bits4(mul(a, b)));
  console.log(bits4(div(a, b)));
  console.log(bits4(neg(f32x4(0, -zero32, 1, -2))));
  console.log(bits4(abs(f32x4(-zero32, -1.5, 2, -3))));
  console.log(bits4(sqrt(f32x4(4, 2, 0, -zero32))));
  console.log(bits4(min(f32x4(-zero32, 1, 2, tiny), f32x4(0, -1, 2, 0))));
  console.log(bits4(max(f32x4(-zero32, 1, 2, tiny), f32x4(0, -1, 2, 0))));
  const m = min(f32x4(nan32, 1, 2, 3), splatF32x4(0));
  console.log(extract(m, 0) !== extract(m, 0));
  console.log(f32ToBits(sum(f32x4(0.1, 0.2, 0.3, 1.0e7))));
  console.log(f32ToBits(sum(splatF32x4(-zero32))));
  console.log(bitmask(lt(a, b)));
  console.log(bitmask(le(a, a)));
  console.log(bitmask(gt(a, b)));
  console.log(bitmask(ge(a, b)));
  console.log(bitmask(eq(f32x4(nan32, -zero32, 1, 2), f32x4(nan32, 0, 1, 3))));
  console.log(bitmask(ne(f32x4(nan32, -zero32, 1, 2), f32x4(nan32, 0, 1, 3))));
  console.log(`${any(lt(a, b))} ${all(lt(a, b))} ${all(eq(a, a))}`);
  console.log(bits4(select(lt(a, b), a, b)));
  const c = f64x2(0.1, -1.0e308);
  const d = f64x2(0.2, 10);
  console.log(bits2(add(c, d)));
  console.log(bits2(mul(c, d)));
  console.log(bits2(div(c, f64x2(0, 3))));
  console.log(bits2(sqrt(f64x2(2, 0.25))));
  console.log(f64ToBits(sum(c)));
  console.log(bitmask(lt(c, d)));
  return 0;
};
