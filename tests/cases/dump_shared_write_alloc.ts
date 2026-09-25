// Allocation is not a shared write: the arena block is unreachable until the
// function returns it, and a push onto the function's own stack array writes a
// header nobody else holds. Only the push onto the parameter is shared.
interface Point {
  x: number;
  y: number;
}

const make = (x: number): Point => {
  return { x: x, y: x + 1 };
};

const label = (n: number): string => `n=${n}`;

const sum = (n: number): number => {
  const acc: number[] = [];
  for (let i = 0; i < n; i++) {
    acc.push(i);
  }
  let total = 0;
  for (const v of acc) {
    total += v;
  }
  return total;
};

const grow = (xs: number[], v: number): void => {
  xs.push(v);
};

export const run = (xs: number[]): number => {
  grow(xs, sum(3));
  return make(label(1).length).y;
};
