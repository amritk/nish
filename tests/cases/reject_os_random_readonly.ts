// WP34 N3: the call writes its argument, so a readonly u8[] is refused as a
// store through it is.
const refill = (key: readonly u8[]): void => {
  crypto.getRandomValues(key);
};

export const test = (): number => {
  refill([1, 2, 3]);
  return 0;
};
