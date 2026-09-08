// Bitwise operators have no panic path. A checked `/` or `a[i]` branches to a
// `noreturn` runtime call and costs the function both `readnone` and
// `willreturn`; nothing here can fail, so the `attributes #0` line below still
// carries all three. That is the property this case exists to pin.
function hashStep(h: i32, byte: i32): i32 {
  return ((h ^ byte) << 5) | (h >>> 27);
}

export function test(): number {
  return hashStep(7, 3) & 1023;
}
