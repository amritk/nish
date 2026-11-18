// `++` is an assignment too, and reaches the same rejection as `=`.
const LIMIT: i32 = 10;

export const test = (): number => {
  LIMIT++;
  return LIMIT;
};
