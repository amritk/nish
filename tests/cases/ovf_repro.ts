// The program that showed signed overflow was undefined: `x + 1 > x` folded to
// `true` while `x + 1` printed -2147483648. It is a panic now, "attempt to add
// with overflow", exit 1, and nothing is printed (tests/run.js builds it at
// `--profile speed`, where the fold happened). ovf_repro_wrapping is the same
// program under `--wrapping`, where the wrap is defined and printed.
const grows = (x: i32): boolean => x + 1 > x;
export const main = (): i32 => {
  const x: i32 = 2147483646 + process.argv.length;
  console.log(`x + 1 > x is ${grows(x)}, x + 1 = ${x + 1}`);
  return 0;
};
