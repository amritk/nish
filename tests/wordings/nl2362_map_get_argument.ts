// NL2362: a `V | undefined` passed as an argument.
const use = (x: i32): i32 => x;
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return use(m.get("a"));
};
