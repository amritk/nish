// The conversions, run natively. `toU32(-1)` is 4294967295 and converting
// back gives -1: the bits never move, only the way they are read. Widening a
// u8 zero-extends, so 200 stays 200 rather than becoming -56.
function test(): number {
  const neg: i32 = -1;
  const w: u32 = toU32(neg);
  const b: u8 = 200;
  const q: u64 = toU64(w);
  console.log(`${w} ${toI32(w)} ${toU16(b)} ${toI32(b)} ${q}`);
  console.log(`${toU8(w)} ${toU16(w)} ${toU64(neg)}`);
  const f: f64 = toF64(w);
  console.log(`${f} ${toU32(f)}`);
  return toI32(toU8(w));
}
