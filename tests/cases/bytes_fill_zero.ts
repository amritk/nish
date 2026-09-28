// WP34 N2: a wider element is filled by a plain store loop, counted and with
// nothing else in it. `opt -O2` makes a `memset` of it when the value is a
// repeated byte, which is why the emitter writes no second lowering for zero;
// tests/run.js holds it to that.
export const clear = (xs: i32[]): void => {
  xs.fill(0);
};

export const test = (): number => {
  const xs: i32[] = [1, 2, 3];
  clear(xs);
  return xs[0] + xs[1] + xs[2];
};
