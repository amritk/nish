// NL2402: `crypto.getRandomValues` fills a u8[] and nothing wider.
export const main = (): i32 => {
  const words: i32[] = [0, 0];
  crypto.getRandomValues(words);
  return 0;
};
