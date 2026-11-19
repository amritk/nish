// WP66 S5: a `CountedBy` count past its buffer's length stops the program
// before C runs, at each width a count takes: a `u16` widened with `zext`
// (40000 sets the top bit, which a `sext` would make negative and pass), a
// `u32`, and an out class's `u64` field read after every argument ran. Each
// call panics `ffi-length` with exit 1, and its C function, which prints when
// it runs, never prints.
declare class OutLen {
  value: u64
}

declare function c_narrow(n: u16, src: CountedBy<readonly u8[], "n">): u32
declare function c_wide(dst: CountedBy<u8[], "n">, n: u32): i32
declare function c_out(dest: CountedBy<u8[], "destLen">, destLen: OutLen): i32

export const narrow = (): i32 => {
  const b: u8[] = [1, 2, 3, 4]
  return toI32(c_narrow(toU16(5), b))
}

export const narrowHigh = (): i32 => {
  const b: u8[] = [1, 2, 3, 4]
  return toI32(c_narrow(toU16(40000), b))
}

export const wide = (): i32 => {
  const b = new Array<u8>(6)
  return c_wide(b, toU32(7))
}

export const out = (): i32 => {
  const b = new Array<u8>(8)
  const len = new OutLen()
  len.value = toU64(9)
  return c_out(b, len)
}
