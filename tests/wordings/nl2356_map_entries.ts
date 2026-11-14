// NL2356: `entries` on the global `Map`; a `[key, value]` pair is a two-type tuple.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.entries();
  return 0;
};
