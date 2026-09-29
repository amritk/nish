// WP34 N3: the fill is a statement; the bytes are already in the caller's array.
export const test = (): number => {
  const key = new Array<u8>(16);
  const same = crypto.getRandomValues(key);
  return 0;
};
