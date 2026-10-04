// ovf_repro under `--wrapping` (see .args): two's-complement arithmetic with
// no check, defined rather than undefined, so `x + 1 > x` is `false` and
// `x + 1` is -2147483648 at every optimisation level.
const grows = (x: i32): boolean => x + 1 > x;
export const main = (): i32 => {
  const x: i32 = 2147483646 + process.argv.length;
  console.log(`x + 1 > x is ${grows(x)}, x + 1 = ${x + 1}`);
  return 0;
};
