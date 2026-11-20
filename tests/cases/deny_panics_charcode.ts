// --deny-panics reads `charCodeAt` as a byte, [0, 255], so `+ 1` on it is
// `nsw` with no overflow check; the guard proves the index. Byte 255 is the
// edge.
const next = (t: string, i: i32): i32 => {
  if (i < 0 || i >= toI32(t.length)) return 0;
  return toI32(t.charCodeAt(i)) + 1;
};

export const main = (): number => {
  const t = "a" + String.fromCharCode(255);
  console.log(next(t, 0));
  console.log(next(t, 1));
  console.log(next(t, 2));
  return 0;
};
