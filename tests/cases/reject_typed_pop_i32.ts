// WP33 R2: `Int32Array` has a fixed length in TypeScript, so `pop` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: Int32Array = new Int32Array(2);
  return xs.pop();
};
