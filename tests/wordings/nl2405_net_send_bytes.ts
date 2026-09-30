// NL2405: `netWrite` sends the bytes of a u8[] and nothing else.
export const main = (): i32 => {
  const words: i32[] = [0, 0];
  return netWrite(1, words, 0, 2);
};
