// WP32: nor the operand of a unary operator.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return -m.get("a");
};
