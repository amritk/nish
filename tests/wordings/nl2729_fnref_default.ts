// NL2729: a function with a defaulted parameter named as a value. A call
// through a reference passes every parameter, so the function must take
// exactly those.
const scale = (x: i32, by: i32 = 2): i32 => x * by;

export const main = (): i32 => {
  const f = scale;
  return 0;
};
