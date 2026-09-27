// A separator after the decimal point; tsc: TS6188.
export const main = (): i32 => {
  const x: f64 = 1._5;
  console.log(`${x}`);
  return 0;
};
