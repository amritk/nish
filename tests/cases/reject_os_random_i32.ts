// WP34 N3: `crypto.getRandomValues` fills a u8[] only, not a wider integer array.
export const test = (): number => {
  const words: i32[] = [0, 0];
  crypto.getRandomValues(words);
  return 0;
};
