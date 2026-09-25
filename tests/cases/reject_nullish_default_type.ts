// WP32: the default of `??` stands in for the value, so it has the value's type.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.get("a") ?? "none";
};
