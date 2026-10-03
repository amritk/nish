// #385: `secureZero` clears a u8[] only, not a wider integer array.
export const test = (): number => {
  const words: i32[] = [7, 8];
  secureZero(words);
  return 0;
};
