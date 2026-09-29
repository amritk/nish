// WP34 N2: a `u64` end of `fill` is never negative, even with its top bit set:
// 2^63 and 2^64-1 are past the end, so as a start they fill nothing and as an
// end they fill to the length (`llvm.umin`, where the signed clamp would count
// them back from the end). An `i64` at INT64_MIN and INT64_MAX keeps the
// signed, JavaScript clamp. `set` at an in-range `u64` offset copies there;
// `bytes_set_u64_oob` pins the offsets it refuses.
const show = (xs: u8[]): string => {
  const parts: string[] = [];
  for (const x of xs) {
    parts.push(`${x}`);
  }
  return parts.join(" ");
};

export const main = (): i32 => {
  const top: u64 = toU64(1) << 63;
  const all: u64 = ~toU64(0);
  const lo: i64 = toI64(1) << 63;
  const hi: i64 = ~lo;
  const a: u8[] = [1, 2, 3, 4, 5];
  a.fill(9, top);
  console.log(show(a));
  a.fill(8, 0, top);
  console.log(show(a));
  a.fill(7, all);
  a.fill(6, 3, all);
  console.log(show(a));
  a.fill(5, lo, 1);
  a.fill(4, hi);
  a.fill(3, 1, lo);
  console.log(show(a));
  const b: u8[] = [0, 0];
  const three: u64 = toU64(3);
  a.set(b, three);
  console.log(show(a));
  return 0;
};
