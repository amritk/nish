// `new Array` has no element type to infer from: annotate it.
export const run = (): number => {
  const a = new Array(4);
  return a.length;
};
