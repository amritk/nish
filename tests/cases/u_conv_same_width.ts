// A conversion between two integers of the same width and different
// signedness moves no bits, so it emits NO instruction at all: the golden's
// two functions are a bare `ret` of the parameter. Signedness is not part of
// the LLVM type, which is what makes an unsigned type free to represent.
export function asUnsigned(x: i32): u32 {
  return toU32(x);
}

export function asSigned(x: u64): i64 {
  return toI64(x);
}
