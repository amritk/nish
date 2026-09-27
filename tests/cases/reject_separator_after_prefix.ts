// A separator straight after a radix prefix is not between two digits
// (issue #263); tsc: TS6188.
export const main = (): i32 => {
  const mask: i32 = 0x_FF;
  console.log(`${mask}`);
  return 0;
};
