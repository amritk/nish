// WP33 R2: `Float32Array` has a fixed length in TypeScript, so `pop` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: Float32Array = new Float32Array(2);
  xs.pop();
  return xs.length;
};
