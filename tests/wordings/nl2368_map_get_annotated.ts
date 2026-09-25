// NL2368: a `V | undefined` initialising a `const` annotated `V`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const j: i32 = m.get("a");
  return j;
};
