// The same comparison written the other way round is always true (NL2694).
export const main = (): i32 => {
  const n: u8 = toU8(4);
  if (0 <= n) {
    return 0;
  }
  return 1;
};
