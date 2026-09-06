// Conversions across every adjacent pair of widths and both signednesses, plus
// the shifts. `toU32(-1)` is 4294967295 and `i32 >>> n` keeps the signed bits,
// which is the difference `u32` exists to make visible.
export function main(): number {
  const w: u32 = 4000000000;
  console.log(`${toI32(w)}`);
  console.log(`${toU32(toI32(w))}`);
  console.log(`${toU8(w)}`);
  console.log(`${toU16(w)}`);
  console.log(`${toU64(w)}`);
  console.log(`${toF64(w)}`);

  const b: u8 = 200;
  console.log(`${toU16(b)} ${toU32(b)} ${toU64(b)} ${toI32(b)}`);

  const h: u16 = 60000;
  console.log(`${toU8(h)} ${toU32(h)} ${toI32(h)}`);

  const neg: i32 = -1;
  console.log(`${toU8(neg)} ${toU16(neg)} ${toU32(neg)} ${toU64(neg)}`);

  const q: u64 = toU64(0) - toU64(1);
  console.log(`${toU32(q)} ${toU16(q)} ${toU8(q)} ${toI64(q)}`);

  // f64 -> unsigned saturates at 0 and at the width's maximum.
  const over: f64 = 300.7;
  const under: f64 = -5.5;
  const huge: f64 = 1000000000000.0;
  const inRange: f64 = 200.9;
  const wide: f64 = 3000000000.5;
  console.log(`${toU8(over)} ${toU8(under)} ${toU32(huge)} ${toU32(-huge)}`);
  console.log(`${toU8(inRange)} ${toU32(wide)}`);

  // Shifts. `>>` and `>>>` are the same on an unsigned type.
  console.log(`${w >> 1} ${w >>> 1}`);
  console.log(`${w >> 31} ${w >>> 31}`);
  console.log(`${b >> 3} ${h >> 5}`);
  console.log(`${q >> 32} ${q >>> 63}`);

  const s: i32 = -16;
  console.log(`${s >> 2}`); // ashr: stays negative
  console.log(`${s >>> 2}`); // lshr, read back as a signed i32
  const l: i64 = toI64(-16);
  console.log(`${l >> 2}`);
  console.log(`${l >>> 2}`);
  return 0;
}
