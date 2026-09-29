// WP33 NL8011, quiet: an integer has no negative zero, and a double put into
// a string first reads `0` in both, because String(-0) is "0" in JavaScript.
export const main = (): number => {
  const zero: f64 = -0.0;
  const n: i32 = 0;
  console.log(n);
  console.log(`${zero}`);
  console.log("done");
  console.log(zero < 0.0);
  return 0;
};
