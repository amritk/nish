// A separator straight after the exponent marker, straight after its sign,
// and at the end of its digits; tsc: TS6188, once for each literal.
export const main = (): i32 => {
  const x: f64 = 1e_5;
  const y: f64 = 1e+_5;
  const z: f64 = 1e5_;
  console.log(`${x} ${y} ${z}`);
  return 0;
};
