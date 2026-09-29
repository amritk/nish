// WP33 NL8011: a double handed straight to `console.log` or `console.error`
// prints -0 as 0 here, and Node's console prints -0.
export const main = (): number => {
  const zero: f64 = -0.0;
  console.log(zero);
  console.log(zero * 2.0);
  console.error(zero);
  return 0;
};
