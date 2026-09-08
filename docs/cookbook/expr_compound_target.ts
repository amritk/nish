class Flags {
  bits: i32 = 0;
}

function set(f: Flags, mask: i32): void {
  f.bits |= mask;
}

function clamp(bytes: i32[], i: i32): void {
  bytes[i] &= 255;
}

function shiftField(f: Flags, n: i32): void {
  f.bits <<= n;
}
