// WP34 N3: under the default number mode `Date.now()` is still an f64 — an
// i32 of milliseconds overflowed in January 1970 — so the comparison is a
// floating-point one and the literal is read as a double.
export const test = (): number => {
  const t = Date.now();
  return t > 1.7e12 ? 1 : 0;
};
