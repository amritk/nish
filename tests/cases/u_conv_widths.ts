// Widening an unsigned value is `zext` (never `sext`, or 255 as a u8 would
// become -1 as an i32) and narrowing is `trunc`, in both directions between
// every adjacent pair of widths.
export const widen8 = (x: u8): u16 => {
  return toU16(x);
};

export const widen16 = (x: u16): u32 => {
  return toU32(x);
};

export const widen32 = (x: u32): u64 => {
  return toU64(x);
};

export const narrow64 = (x: u64): u32 => {
  return toU32(x);
};

export const narrow32 = (x: u32): u16 => {
  return toU16(x);
};

export const narrow16 = (x: u16): u8 => {
  return toU8(x);
};
