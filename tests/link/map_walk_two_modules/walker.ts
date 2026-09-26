// The other module: it walks a map's values and a set, with an early `return`
// out of the second walk.
export const total = (m: Map<string, i32>): i32 => {
  let sum: i32 = 0;
  for (const v of m.values()) {
    sum += v;
  }
  return sum;
};

export const firstLong = (s: Set<string>, min: i32): string => {
  for (const x of s) {
    if (x.length >= min) {
      return x;
    }
  }
  return "";
};
