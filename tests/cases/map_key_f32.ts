// WP32 (docs/wp32-map.md §5.2): an `f32` key is widened with `fpext` and then
// hashed as an `f64`, normalised first, and compared by SameValueZero: -0 is
// +0, and a NaN is a key that finds itself.
export const main = (): i32 => {
  const zero: f32 = 0.0;
  const minusZero: f32 = -zero;
  const nan: f32 = zero / zero;
  const half: f32 = 0.5;
  const m = new Map<f32, i32>();
  m.set(minusZero, 1).set(nan, 2).set(half, 3);
  console.log(`${m.has(zero)} ${m.has(nan)} ${m.has(half)} ${m.size}`);
  m.set(zero, 4).set(zero / zero, 5);
  console.log(`${m.size} ${m.delete(nan)} ${m.has(nan)} ${m.size}`);
  return 0;
};
