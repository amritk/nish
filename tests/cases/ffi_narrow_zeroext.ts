// #1755: a `u8`, `u16` or `boolean` crossing a `declare function` is an
// `unsigned char`, `unsigned short` or `_Bool` to C, and the x86-64 SysV and
// Apple arm64 ABIs widen it in the caller: clang compiles `widen_u8` to a bare
// `mov eax, edi`. So the `declare` and every `call` carry `zeroext` on each
// narrow parameter and result. `ident` (in ffi_narrow_zeroext.c) hides 511 from
// the optimiser, so the truncation happens at run time with the high bits
// still in the register; without the attribute C saw 511, not 255.
declare function ident(x: i64): i64;
declare function widen_u8(x: u8): u32;
declare function widen_u16(x: u16): u32;
declare function pick(b: boolean): i32;
declare function low_byte(x: u32): u8;
declare function is_odd(x: u32): boolean;

export const run = (): i32 => {
  const n = ident(511);
  console.log(`widen_u8(toU8(511)): ${widen_u8(toU8(n))}`);
  const m = ident(196611);
  console.log(`widen_u16(toU16(196611)): ${widen_u16(toU16(m))}`);
  console.log(`pick(true): ${pick(n > 0)}`);
  console.log(`pick(false): ${pick(n < 0)}`);
  const b = low_byte(toU32(n));
  console.log(`low_byte(511): ${b}`);
  console.log(`is_odd(511): ${is_odd(toU32(n))}`);
  return toI32(widen_u8(toU8(n)));
};
