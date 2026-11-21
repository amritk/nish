// `join` is `string[]` only: converting elements would allocate per element,
// which is the shape `join` exists to avoid.
const f = (xs: number[]): string => {
  return xs.join(", ");
};
