// NL2369: a `V | undefined` anywhere else.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.get("a");
  return 0;
};
