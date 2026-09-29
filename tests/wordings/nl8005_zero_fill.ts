// NL8005: a zero-filled `new Array<f64>(n)`, which TypeScript fills with holes.
export const main = (): number => {
  const n = 4;
  const xs = new Array<f64>(n);
  return xs.length;
};
