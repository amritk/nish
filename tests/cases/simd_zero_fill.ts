// `new Array<V>(n)` of a vector fills every slot with the zero vector, each
// slot its own: writing one slot leaves the others zero. Under Node through
// `--emit-ts` each slot is a fresh zero typed array.
import { i32x4, f64x2, u8x16, extract, replace } from "nish:simd";

class Grid {
  n: i32;
  cells: i32x4[];
  constructor(n: i32) {
    this.n = n;
    this.cells = new Array<i32x4>(n);
  }
}

export const main = (): number => {
  const xs = new Array<i32x4>(3);
  xs[0] = replace(xs[0], 1, 4);
  console.log(`${extract(xs[0], 1)} ${extract(xs[1], 1)} ${extract(xs[2], 3)}`);
  const ys = new Array<f64x2>(2);
  ys[1] = replace(ys[1], 0, 2.5);
  console.log(`${extract(ys[0], 0)} ${extract(ys[1], 0)} ${extract(ys[1], 1)}`);
  const bs = new Array<u8x16>(2);
  console.log(`${extract(bs[1], 15)} ${bs.length}`);
  const g = new Grid(2);
  g.cells[1] = replace(g.cells[1], 3, 7);
  console.log(`${extract(g.cells[0], 3)} ${extract(g.cells[1], 3)} ${g.n}`);
  return 0;
};
