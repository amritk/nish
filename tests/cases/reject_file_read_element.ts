// WP44: a file is read as bytes, so `fileReadAt` fills a u8[] only, not a
// wider integer array whose byte order would be the machine's.
export const main = (): number => {
  const words: i32[] = [0, 0];
  return fileReadAt(-1, words, 0, 2, toI64(0));
};
