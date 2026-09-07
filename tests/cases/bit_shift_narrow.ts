// A shift count is masked to the *operand's* width, not to 31, so the narrow
// unsigned widths mask to 7 and 15. `a << 8` on a `u8` is `a << 0`, which is
// the JavaScript rule applied at a width JavaScript does not have; without the
// mask LLVM would make it poison.
export function shiftByWidth(a: u8): u8 {
  return a << 8;
}

export function shiftU16(a: u16, n: u16): u16 {
  return a << n;
}

export function main(): void {
  console.log(toI32(shiftByWidth(37)));
  console.log(toI32(shiftU16(3, 17)));
}
