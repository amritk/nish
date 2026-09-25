// WP32: the value widths whose lowering the other cases do not reach: an enum
// (an `i32` in memory), `i64`, `u64` and `f32`. A missing `const` holds each
// width's zero, `0`, `0` and `0.0`, and nothing reads it.
enum Color {
  Red = 1,
  Blue = 2,
}

export const main = (): i32 => {
  const colors = new Map<string, Color>();
  colors.set("sky", Color.Blue);
  const sky = colors.get("sky");
  const grass = colors.get("grass");
  const big = new Map<i32, i64>();
  big.set(1, toI64(1) << 40);
  const wide = new Map<i32, u64>();
  wide.set(1, toU64(7));
  const small = new Map<i32, f32>();
  small.set(1, toF32(1.5));
  const s = small.get(1);
  const blue = sky !== undefined && sky === Color.Blue;
  console.log(`${blue} ${grass === undefined} ${(big.get(1) ?? toI64(0)) >> 40} ${wide.get(2) ?? toU64(9)} ${s !== undefined ? s : toF32(0.0)}`);
  return 0;
};
