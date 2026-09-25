// NL2361: a `V | undefined` held in a `let`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let i = m.get("a");
  return 0;
};
