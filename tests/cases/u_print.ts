// Printing a value above INT_MAX must show it unsigned. Every width goes
// through the one `sts_str_from_u64`, with a `zext` at the call site for the
// narrow three, so `4294967295` prints as itself and not as `-1`.
function test(): number {
  const b: u8 = 200;
  const h: u16 = 60000;
  const w: u32 = 4294967295;
  const q: u64 = toU64(0) - toU64(1);
  console.log(w);
  console.log(`${b} ${h} ${w} ${q}`);
  return 0;
}
