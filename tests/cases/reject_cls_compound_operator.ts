// A field takes the five arithmetic compound assignments and no others.
export class Counter {
  n: number = 0;
}

export const run = (c: Counter): number => {
  c.n **= 2;
  return c.n;
};
