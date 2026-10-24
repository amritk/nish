// Math.round on the values where a lowering goes wrong: ties (toward +Infinity),
// the largest double below 0.5, the edges of 2^52, NaN, the infinities and the
// subnormals. The operands come from an array so that the rounding runs at run
// time, not in the optimiser's constant folding; `1 / r` shows the sign of a zero.
export const main = (): i32 => {
  const one = toF64(1);
  const zero = toF64(0);
  const xs: f64[] = [
    zero,
    -zero,
    0.5,
    -0.5,
    1.5,
    -1.5,
    2.5,
    -2.5,
    0.49999999999999994,
    -0.49999999999999994,
    4503599627370495.5,
    -4503599627370495.5,
    4503599627370496.0,
    -4503599627370496.0,
    9007199254740993.0,
    one / zero,
    -one / zero,
    zero / zero,
    -1e-300,
    2.225073858507201e-308,
    -2.225073858507201e-308,
    5e-324,
    -5e-324,
  ];
  for (let i = 0; i < xs.length; i++) {
    const r = Math.round(xs[i]);
    console.log(`${xs[i]} ${r} ${one / r}`);
  }
  return 0;
};
