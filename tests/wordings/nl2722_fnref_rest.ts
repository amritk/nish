// NL2722: a function with a rest parameter named as a value. A call through
// a reference passes every parameter, so the function must take exactly those.
const sum = (...xs: i32[]): i32 => xs.length;

export const main = (): i32 => {
  const f = sum;
  return 0;
};
