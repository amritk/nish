// NL2371: a `V | undefined` as the default of another `??`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.get("a") ?? m.get("b") ?? 0;
};
