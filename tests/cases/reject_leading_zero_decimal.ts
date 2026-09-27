// A decimal literal with a leading zero, alone, with a fraction and with an
// exponent; tsc: TS1489, once for each literal (issue #271).
export const main = (): i32 => {
  const nine: i32 = 09;
  const x: f64 = 08.5;
  const y: f64 = 09e1;
  console.log(`${nine} ${x} ${y}`);
  return 0;
};
