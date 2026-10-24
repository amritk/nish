// Math.floor, ceil, trunc and round at their edges: the halves, the last values
// below 2^52 and 2^53 where every f64 is already an integer, the subnormals, the
// infinities, NaN and each -0 result. The operands are parsed at run time, so no
// call folds, and x86-64 runs every call through the runtime's rounders: SSE4.1
// `roundsd` where the CPU has it, libm under `NISH_SIMD=base` (tests/run.js runs
// this case both ways). `-0` is spelled out, since interpolation prints it as `0`.
const show = (x: f64): string => (x === 0 && 1 / x < 0 ? "-0" : `${x}`);

export const main = (): i32 => {
  const zero = parseFloat("0");
  const inputs: f64[] = [
    zero, -zero, parseFloat("0.5"), parseFloat("-0.5"), parseFloat("1.5"), parseFloat("-1.5"),
    parseFloat("2.5"), parseFloat("-2.5"), parseFloat("0.49999999999999994"),
    parseFloat("-0.49999999999999994"), parseFloat("4503599627370495.5"),
    parseFloat("-4503599627370495.5"), parseFloat("4503599627370496"),
    parseFloat("9007199254740993"), parseFloat("-1e-300"), parseFloat("1e-300"),
    parseFloat("5e-324"), parseFloat("-5e-324"), parseFloat("2.225073858507201e-308"),
    parseFloat("-2.225073858507201e-308"), 1 / zero, -1 / zero, zero / zero,
  ];
  for (const x of inputs) {
    console.log(`${show(x)}: floor ${show(Math.floor(x))} ceil ${show(Math.ceil(x))} trunc ${show(Math.trunc(x))} round ${show(Math.round(x))}`);
  }
  return 0;
};
