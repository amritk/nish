// WP34 N5: a socket carries bytes, so `netRead` fills a u8[] only, not a wider
// integer array whose byte order would be the machine's.
export const main = (): number => {
  const words: i32[] = [0, 0];
  return netRead(-1, words, 0, 2);
};
