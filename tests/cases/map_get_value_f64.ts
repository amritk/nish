// WP32: an `f64` value; the zero of a missing `const` is `0.0`, never read.
export const main = (): i32 => {
  const m = new Map<string, f64>();
  m.set("pi", 3.25);
  const v = m.get("pi");
  const w = m.get("e");
  console.log(`${m.get("pi") ?? 0.5} ${m.get("e") ?? 0.5} ${v !== undefined ? v : 0} ${w === undefined}`);
  return 0;
};
