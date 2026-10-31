// WP32 (docs/wp32-map.md §5.2): two `i32`s keyed as one `i64`, `(toI64(hi) << toI64(32)) | (toI64(lo) & toI64(0xffffffff))`,
// with no string built. Every operand is an `i64`: under Node each is a BigInt, which a bare `32` could not shift. `lo`
// fills the low half unsigned, so nothing is added and nothing overflows: an `+` would leave the `i64` range at
// `hi = -2^31, lo < 0` (the last two pairs below). The key is exact on both sides, and distinct, for every pair.
const pack = (hi: i32, lo: i32): i64 => (toI64(hi) << toI64(32)) | (toI64(lo) & toI64(0xffffffff));

export const main = (): i32 => {
  const grid = new Map<i64, number>();
  let cell = 0;
  for (let y: i32 = -2; y <= 2; y++) {
    for (let x: i32 = -2; x <= 2; x++) {
      grid.set(pack(y, x), cell);
      cell = cell + 1;
    }
  }
  grid.set(pack(-1, -1), 99);
  grid.set(pack(2147483647, -2147483648), 7);
  grid.set(pack(-2147483648, 2147483647), 8);
  grid.set(pack(-2147483648, -1), 9);
  grid.set(pack(-2147483648, -2147483648), 10);
  const swapped = grid.get(pack(1, -2)) ?? 0;
  const corner = grid.get(pack(-2, 1)) ?? 0;
  const absent = grid.get(pack(3, 0)) ?? -1;
  console.log(`${grid.size} ${swapped} ${corner} ${absent} ${grid.get(pack(-1, -1)) ?? 0}`);
  console.log(`${grid.has(pack(0, -1))} ${grid.has(pack(-1, 0))} ${grid.has(pack(0, 4))}`);
  grid.delete(pack(0, 0));
  let walked: i32 = 0;
  let last: i64 = toI64(0);
  for (const key of grid.keys()) {
    walked = walked + 1;
    last = key;
  }
  console.log(`${walked} ${last} ${grid.get(pack(2147483647, -2147483648)) ?? 0} ${grid.get(last) ?? 0}`);
  console.log(`${pack(-2147483648, -1)} ${pack(-2147483648, -2147483648)} ${pack(-1, -1)} ${pack(0, -1)}`);
  console.log(`${grid.get(pack(-2147483648, -1)) ?? 0} ${grid.get(pack(-2147483648, 2147483647)) ?? 0}`);
  return 0;
};
