// --deny-panics reads `charCodeAt` as [0, 255], so a sum that fits only below
// byte 2 stays checked: 255 + 2147483393 passes 2^31 - 1.
export const f = (t: string, i: i32): i32 => {
  if (i < 0 || i >= toI32(t.length)) return 0;
  return toI32(t.charCodeAt(i)) + 2147483393;
};
