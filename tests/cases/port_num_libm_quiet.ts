// WP33 NL8010, quiet: `Math.min` and `Math.max` of integers have no NaN and no
// signed zero to disagree about, and `Math.floor` and `Math.abs` of a double
// answer the same in both readings.
export const main = (): i32 => {
  const a: i32 = 3;
  const low = Math.min(a, 7);
  const high = Math.max(a, 7);
  const down = Math.floor(-2.5);
  const size = Math.abs(-2.5);
  console.log(low + high);
  console.log(`${down + size}`);
  return 0;
};
