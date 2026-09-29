// WP33 NL8011, retired: a double handed straight to `console.log` or
// `console.error` prints -0 as 0 here, and so does the TypeScript reading,
// whose console (`runtime/nish.mjs`) prints String(x). Nothing may warn.
export const main = (): number => {
  const zero: f64 = -0.0;
  console.log(zero);
  console.log(zero * 2.0);
  console.error(zero);
  return 0;
};
