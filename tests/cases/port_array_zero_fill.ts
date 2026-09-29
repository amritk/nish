// WP33 NL8005: `new Array<T>(n)` of a number or a boolean is `n` zeros here and
// `n` holes in TypeScript, which read back as `undefined`, so every sum below is
// 0 natively and NaN under Node. Each allocation is reported once: in a method,
// at a literal length that is not 0, and in a generic function at the one node
// its two numeric instantiations share.
class Grid {
  cells: i32[];

  constructor(side: i32) {
    this.cells = new Array<i32>(side * side);
  }
}

function startingWith<T>(n: i32, first: T): T[] {
  const out = new Array<T>(n);
  out[0] = first;
  return out;
}

const total = (xs: f64[]): f64 => {
  let sum: f64 = 0;
  for (const x of xs) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): number => {
  const n = 3;
  const weights = new Array<f64>(n);
  const seen = new Array<boolean>(n + 1);
  const counts = new Array<number>(n);
  const bytes = new Array<u8>(4);
  const grid = new Grid(2);
  const half: f64 = 0.5;
  const floats = startingWith(n, half);
  const ints = startingWith(n, 1);
  console.log(total(weights));
  console.log(seen[0] ? 1 : 0);
  console.log(counts[1] + toI32(bytes[2]) + grid.cells[3] + ints[0]);
  console.log(total(floats));
  return 0;
};
