// Ordering on an unsigned type is `icmp ult`/`ugt`, not `slt`/`sgt`.
// 4000000000 has bit 31 set, so as an i32 it is negative: a signed compare
// would say it is *less* than 7. This is the case that proves the difference.
function test(): number {
  const big: u32 = 4000000000;
  const small: u32 = 7;
  console.log(`${big > small} ${big < small} ${big >= big} ${small <= big}`);
  return 0;
}
