// NL2237: A spread copies an unknown number of elements, which the literal's fixed length cannot express.
export const main = (): i32 => {
  const ys: i32[] = [1];
  const xs: i32[] = [...ys];
  return 0;
};
