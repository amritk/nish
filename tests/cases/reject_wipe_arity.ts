// #385: one argument, the array to clear.
export const test = (): number => {
  const key = new Array<u8>(16);
  secureZero(key, key);
  return 0;
};
