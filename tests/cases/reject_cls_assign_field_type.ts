// A field holds its declared type: there is no conversion on the way in.
export class Counter {
  n: number = 0;
}

export const run = (c: Counter): number => {
  c.n = "one";
  return c.n;
};
