// A separator straight after the exponent marker; tsc: TS6188.
export const main = (): i32 => {
  const x: f64 = 1e_5;
  console.log(`${x}`);
  return 0;
};
