// --deny-panics reads `charCodeAt` as a byte, [0, 255], so `+ 1` on it is
// `nsw` with no overflow check; the guard proves the index. `ÿ` is the two
// UTF-8 bytes C3 BF, the same under a native run and `--emit-ts`.
const next = (t: string, i: i32): i32 => {
  if (i < 0 || i >= toI32(t.length)) return 0;
  return toI32(t.charCodeAt(i)) + 1;
};

export const main = (): number => {
  const t = "aÿ";
  console.log(next(t, 0));
  console.log(next(t, 1));
  console.log(next(t, 2));
  console.log(next(t, 3));
  return 0;
};
