function mix(a: i32, b: i32): i32 {
  return (a & b) | (a ^ b);
}

function invert(a: i32): i32 {
  return ~a;
}

function pack(hi: i32, lo: i32): i32 {
  return (hi << 16) | (lo & 65535);
}
