// NL2357: `get` on the global `Map`, whose `V | undefined` result lands later.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.get("a");
};
