// Two separators in a row, in a decimal and in a hexadecimal literal; tsc:
// TS6189, once for each literal.
export const main = (): i32 => {
  const ten: i32 = 1__0;
  const mask: i32 = 0xF__F;
  console.log(`${ten} ${mask}`);
  return 0;
};
