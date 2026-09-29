// WP33 NL8010: `Math.min` and `Math.max` of doubles are `minnum` and `maxnum`
// here, which drop a NaN operand where JavaScript answers NaN, and
// `Math.round(-0.4)` is +0 here and -0 in JavaScript, which `1 / r` shows.
export const main = (): i32 => {
  const nan: f64 = 0.0 / 0.0;
  const low = Math.min(nan, 1.0);
  const high = Math.max(2.0, nan);
  const r = Math.round(-0.4);
  console.log(`${low} ${high} ${1.0 / r}`);
  return 0;
};
