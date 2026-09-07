// f64 conversions pick the unsigned family: `uitofp` on the way out, and the
// saturating `llvm.fptoui.sat` on the way in, whose clamp is `0 .. 2^bits-1`,
// so a negative double becomes 0 rather than the type's minimum.
export function toDouble(x: u32): f64 {
  return toF64(x);
}

export function fromDouble(x: f64): u32 {
  return toU32(x);
}

export function byteFromDouble(x: f64): u8 {
  return toU8(x);
}
