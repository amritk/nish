// WP33 R2: `Int32Array` has a fixed length in TypeScript, so `push` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: Int32Array = new Int32Array(2);
  xs.push(3);
  return xs.length;
};
