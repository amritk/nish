// WP34 N3: not even the u32[] a Web `Uint32Array` would be: the byte order of
// the answer would be a fact about the machine.
export const test = (): number => {
  const words: u32[] = [0, 0];
  crypto.getRandomValues(words);
  return 0;
};
