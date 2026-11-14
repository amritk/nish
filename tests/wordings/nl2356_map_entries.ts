// NL2356: `entries` on the global `Map`; there is no destructuring.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.entries();
  return 0;
};
