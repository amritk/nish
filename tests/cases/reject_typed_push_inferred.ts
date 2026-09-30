// WP33 R2: an unannotated binding initialised with `new Float64Array(n)` is a
// `Float64Array` to TypeScript, so it takes the spelling and refuses `push`.
export const test = (): number => {
  const xs = new Float64Array(2);
  xs.push(1.0);
  return xs.length;
};
