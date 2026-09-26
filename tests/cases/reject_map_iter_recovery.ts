// WP32 (docs/wp32-map.md §6.2): a refused walk reports once. Its variable is an
// error, so the body reads it without a second report, and the next
// statement is checked on its own.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const e of m) {
    n = n + e.length;
  }
  const bad: string = 5;
  return n;
};
