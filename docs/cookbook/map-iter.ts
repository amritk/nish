export const total = (m: Map<i32, i32>): i32 => {
  let sum: i32 = 0;
  for (const v of m.values()) {
    if (v < 0) {
      return -1;
    }
    sum += v;
  }
  return sum;
};
