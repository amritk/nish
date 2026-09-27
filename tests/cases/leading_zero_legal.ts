// A zero that leads a literal without another digit straight after it is
// legal: zero itself, a fraction, an exponent and every radix prefix, each the
// value it spells (issue #271).
export const main = (): i32 => {
  const zero: i32 = 0;
  const half: f64 = 0.5;
  const scaled: f64 = 0e1;
  const hex: i32 = 0x0F;
  const bin: i32 = 0b01;
  const oct: i32 = 0o07;
  console.log(`${zero} ${half} ${scaled}`);
  console.log(`${hex} ${bin} ${oct}`);
  return 0;
};
