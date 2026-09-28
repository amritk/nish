// WP34 N2: an array of a ranged integer takes `fill` and `set` too. `fill`'s
// value enters the range once, before the loop, which `put`'s golden shows as
// one check; `set`'s source has the receiver's own ranged type, readonly or
// not, so every element it copies is already in range and nothing is checked.
export const put = (xs: integer<0, 9>[], v: i32): void => {
  xs.fill(v, 1);
};

export const test = (): number => {
  const a: integer<0, 9>[] = [1, 2, 3];
  const b: readonly integer<0, 9>[] = [7];
  put(a, 4);
  a.set(b, 2);
  return toI32(a[0]) * 100 + toI32(a[1]) * 10 + toI32(a[2]);
};
