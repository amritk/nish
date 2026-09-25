// NL2367: a `V | undefined` as an arithmetic operand.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", m.get("a") + 1);
  return 0;
};
