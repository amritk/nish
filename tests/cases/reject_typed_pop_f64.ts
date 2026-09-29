// WP33 R2: `Float64Array` has a fixed length in TypeScript, so `pop` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: Float64Array = new Float64Array(2);
  xs.pop();
  return xs.length;
};
