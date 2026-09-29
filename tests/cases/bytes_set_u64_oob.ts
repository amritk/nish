// WP34 N2: `set`'s range check compares unsigned, so a `u64` offset of 2^63
// or 2^64-1 is past the end and panics. The message prints the offset signed,
// as every range panic does. `bytes_set_u64_oob.c` runs each in a child and
// prints its message and its exit status.
const into = (at: u64): i32 => {
  const dst: u8[] = [0, 0, 0, 0];
  const src: u8[] = [7];
  dst.set(src, at);
  return toI32(dst[0]);
};

export const topBit = (): i32 => into(toU64(1) << 63);

export const allOnes = (): i32 => into(~toU64(0));

export const test = (): i32 => into(toU64(0));
