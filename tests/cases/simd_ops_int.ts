// Integer lane operations: the wrapping `addWrapping`, `subWrapping` and
// `mulWrapping` on every width, signed and unsigned `min`, `max` and
// compares (an `i32x4` lane is signed, a `u…` lane is not), the bitwise
// operators on vectors and on masks, `select`, `any`, `all` and `bitmask`,
// the widening `sum` of `u8x16` and `u16x8` and the wrapping `sumWrapping`
// of a 32-bit vector, `shuffle` across two vectors, and the `as…` casts,
// which reinterpret the sixteen bytes little-endian.
import { u8x16, u16x8, i32x4, u32x4, f32x4, splatU8x16, addWrapping, subWrapping, mulWrapping, and, or, xor, not, min, max, eq, lt, gt, ge, le, ne, select, bitmask, any, all, sum, sumWrapping, shuffle, asU8x16, asU32x4, asI32x4, asF32x4, asU16x8, extract } from "nish:simd";

export const main = (): number => {
  const b = u8x16(250, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 255);
  const c = splatU8x16(10);
  console.log(`${extract(addWrapping(b, c), 0)} ${extract(subWrapping(c, b), 15)} ${extract(mulWrapping(b, c), 15)}`);
  console.log(`${extract(min(b, c), 0)} ${extract(max(b, c), 1)} ${bitmask(lt(b, c))} ${bitmask(ge(b, c))}`);
  console.log(sum(b));
  const h = u16x8(65535, 2, 3, 4, 5, 6, 7, 40000);
  console.log(`${extract(addWrapping(h, h), 0)} ${sum(h)} ${bitmask(gt(h, u16x8(1, 2, 3, 4, 5, 6, 7, 8)))}`);
  const i = i32x4(-5, 2147483647, 7, -2147483648);
  const j = i32x4(3, 1, -7, -1);
  console.log(`${extract(addWrapping(i, j), 1)} ${extract(subWrapping(i, j), 3)} ${extract(mulWrapping(i, j), 3)}`);
  console.log(`${extract(min(i, j), 0)} ${extract(max(i, j), 2)} ${bitmask(lt(i, j))} ${bitmask(le(i, i))} ${bitmask(ne(i, j))}`);
  console.log(sumWrapping(i));
  const u = u32x4(4294967295, 1, 7, 2147483648);
  const w = u32x4(1, 2, 7, 1);
  console.log(`${extract(min(u, w), 0)} ${extract(max(u, w), 3)} ${bitmask(lt(u, w))} ${bitmask(eq(u, w))} ${sumWrapping(u)}`);
  console.log(`${extract(and(u, w), 0)} ${extract(or(u, w), 1)} ${extract(xor(u, w), 2)} ${extract(not(w), 0)}`);
  const m = lt(u, w);
  console.log(`${any(m)} ${all(m)} ${bitmask(not(m))} ${bitmask(and(m, eq(u, u)))} ${bitmask(xor(m, eq(u, u)))}`);
  console.log(extract(select(m, u, w), 1));
  const s = shuffle(i, j, 7, 0, 5, 2);
  console.log(`${extract(s, 0)} ${extract(s, 1)} ${extract(s, 2)} ${extract(s, 3)}`);
  const bs = shuffle(b, c, 15, 16, 0, 31, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
  console.log(`${extract(bs, 0)} ${extract(bs, 1)} ${extract(bs, 2)} ${extract(bs, 3)}`);
  console.log(`${extract(asU8x16(u32x4(0x04030201, 0, 0, 0)), 2)} ${extract(asU32x4(i), 0)} ${extract(asI32x4(u), 0)}`);
  console.log(`${extract(asF32x4(u32x4(0x3f800000, 0, 0, 0)), 0)} ${extract(asU16x8(f32x4(1, 0, 0, 0)), 1)}`);
  return 0;
};
