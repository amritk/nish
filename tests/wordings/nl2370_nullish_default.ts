// NL2370: a default of `??` that is not the value type.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.get("a") ?? "none";
};
