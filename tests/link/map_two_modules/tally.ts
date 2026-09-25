// The other module: it calls `has` and `set` on the map its caller made.
export const record = (m: Map<string, i32>, word: string): void => {
  if (!m.has(word)) {
    m.set(word, 1);
  }
};
