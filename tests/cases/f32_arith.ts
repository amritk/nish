// `f32` is LLVM `float`: the same instructions as `f64`, one width down.
// Division is never checked (that is an integer rule), and `-x` is `fneg`.
export const arith = (a: f32, b: f32): f32 => {
  return (a + b) * (a - b) / b;
};

export const rem = (a: f32, b: f32): f32 => {
  return a % b;
};

export const cmp = (a: f32, b: f32): boolean => {
  return a < b;
};

export const neg = (a: f32): f32 => {
  return -a;
};
