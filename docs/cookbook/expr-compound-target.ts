class Flags {
  bits: i32 = 0;
}

const set = (f: Flags, mask: i32): void => {
  f.bits |= mask;
};

const clamp = (bytes: i32[], i: i32): void => {
  bytes[i] &= 255;
};

const shiftField = (f: Flags, n: i32): void => {
  f.bits <<= n;
};
