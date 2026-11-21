// The bytes are a `u8[]`: a string goes through `write`.
export const main = (): number => {
  return writeBytes("ab", 0, 2);
};
