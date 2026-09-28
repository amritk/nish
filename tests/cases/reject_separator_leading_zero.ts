// A separator after a leading zero, where a legacy octal literal would
// start; tsc: TS6188.
export const main = (): i32 => {
  const one: i32 = 0_1;
  console.log(`${one}`);
  return 0;
};
