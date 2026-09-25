// NL2363: a `V | undefined` returned.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1);
  return m.get("a");
};
