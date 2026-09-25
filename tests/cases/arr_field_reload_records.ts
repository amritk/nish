// The negative of `arr_field_reload`: an array of records keeps them inline
// (WP15 §2a), so an element store *does* write record fields. The slot is
// written by an untagged `llvm.memcpy` and the record's fields are read with no
// `!tbaa` at all, so nothing here may be tagged as an element: `c` views slot 0
// and must see the record the store copied over it, and `c.n` must be reloaded
// after it rather than forwarded from before.
interface Cell {
  n: i32;
  xs: i32[];
}

export class Board {
  cells: Cell[];

  constructor() {
    this.cells = [];
  }

  swap(i: i32, j: i32): i32 {
    const c = this.cells[i];
    const before = c.n;
    const tmp: Cell = { n: this.cells[i].n, xs: this.cells[i].xs };
    this.cells[i] = this.cells[j];
    this.cells[j] = tmp;
    return before * 100 + c.n * 10 + c.xs[0];
  }
}

export const test = (): i32 => {
  const b = new Board();
  b.cells = [{ n: 1, xs: [4] }, { n: 2, xs: [5] }];
  return b.swap(0, 1);
};
