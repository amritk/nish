// NL2373: `values()` of the global `Map` passed as an argument.
const count = (xs: i32[]): i32 => xs.length;

export const main = (): i32 => {
  const m = new Map<string, i32>();
  return count(m.values());
};
