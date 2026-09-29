// WP33 NL8010: `Math.min` and `Math.max` of doubles are `minnum` and `maxnum`
// here, which drop a NaN operand where JavaScript answers NaN, and
// `Math.round(-0.4)` is +0 here and -0 in JavaScript, which `1 / r` shows.
export const main = (): number => {
  const one = toF64(1);
  const nan = toF64(0) / toF64(0);
  const low = Math.min(nan, one);
  const high = Math.max(one + one, nan);
  const r = Math.round(toF64(-4) / toF64(10));
  console.log(`${low} ${high} ${one / r}`);
  return 0;
};
