// WP32 (docs/wp32-map.md §5.2): a `number` key in f64 mode is JavaScript's:
// SameValueZero, so -0 and +0 are one key and every NaN is one key, while
// 0.1 + 0.2 is not 0.3. The float is normalised before it is hashed, so equal
// keys hash equal. Node runs this file unmodified with its own `Map`
// (`tests/differential/unmodified.js`), and the two must print the same.
export const main = (): i32 => {
  const m = new Map<number, string>();
  const zero = 0;
  m.set(-zero, "minus zero");
  m.set(zero / zero, "nan");
  m.set(0.1 + 0.2, "sum");
  console.log(`${m.size} ${m.has(zero)} ${m.has(Math.sqrt(-1))} ${m.has(0.3)} ${m.has(0.1 + 0.2)}`);
  m.set(zero, "plus zero").set(-(zero / zero), "another nan");
  console.log(`${m.size} ${m.delete(-zero)} ${m.has(zero)} ${m.size}`);
  const inf = 1 / zero;
  m.set(inf, "inf").set(-inf, "-inf");
  console.log(`${m.size} ${m.has(1 / zero)} ${m.has(-1 / zero)} ${m.has(1e308)}`);
  return 0;
};
