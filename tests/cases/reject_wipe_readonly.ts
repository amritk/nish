// #385: the call writes its argument, so a readonly u8[] is refused as a
// store through it is.
const forget = (key: readonly u8[]): void => {
  secureZero(key);
};

export const test = (): number => {
  forget([1, 2, 3]);
  return 0;
};
