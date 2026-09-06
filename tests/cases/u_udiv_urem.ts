// `udiv` and `urem`, run natively on a dividend above INT_MAX where the signed
// instructions would give a different answer entirely.
function test(): number {
  const big: u32 = 4000000000;
  const seven: u32 = 7;
  console.log(`${big / seven} ${big % seven}`);
  let acc: u32 = 4294967295;
  acc /= 3;
  acc %= 1000;
  console.log(`${acc}`);
  return 0;
}
