// WP32: a `const` bound to `get` is still a maybe where a test has narrowed it,
// as under `tsc`: it may be tested again, and defaulted with `??`, and both
// read its found bit rather than probing a second time.
export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1);
  const a = m.get("a");
  if (a === undefined) {
    return 1;
  }
  if (a !== undefined) {
    console.log(`${a}`);
  }
  const b = a ?? 3;
  console.log(`${b + 1}`);
  return 0;
};
