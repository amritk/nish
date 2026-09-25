// NL2365: a `V | undefined` stored in an array element.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const a: i32[] = [0];
  a[0] = m.get("a");
  return a[0];
};
