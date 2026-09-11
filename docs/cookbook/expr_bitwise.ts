const mix = (a: i32, b: i32): i32 => (a & b) | (a ^ b);

const invert = (a: i32): i32 => ~a;

const pack = (hi: i32, lo: i32): i32 => (hi << 16) | (lo & 65535);
