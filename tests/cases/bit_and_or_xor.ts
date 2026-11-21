// `& | ^` on two operands of the same integer type: one instruction each, no
// mask and no panic path, which is what separates them from `/` and `%`.
const mix = (a: i32, b: i32): i32 => {
  return (a & b) + (a | b) + (a ^ b);
};

export const test = (): number => {
  return mix(12, 10) + mix(-1, 255);
};
