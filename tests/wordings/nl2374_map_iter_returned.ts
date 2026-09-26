// NL2374: `keys()` of the global `Set` returned.
const keysOf = (s: Set<i32>): i32[] => {
  return s.keys();
};

export const main = (): i32 => keysOf(new Set<i32>()).length;
