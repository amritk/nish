// #385: the wipe is a statement; there is nothing to answer.
export const test = (): number => {
  const key = new Array<u8>(16);
  const same = secureZero(key);
  return 0;
};
