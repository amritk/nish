// WP33 R2: `Float32Array` has a fixed length in TypeScript, so `push` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: Float32Array = new Float32Array(2);
  const v: f32 = 1.5;
  xs.push(v);
  return xs.length;
};
