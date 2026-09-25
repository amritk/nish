// Negative: the field is read into a local and written through it, so its
// array is a value and keeps the pointer layout. `a[0] = 7` must land in the
// field's own array -- the write is read back through `this.cells` -- which
// an inline copy could not promise.
class Holder {
  cells: i32[];

  constructor() {
    this.cells = new Array<i32>(4);
  }

  poke(): void {
    const a = this.cells;
    a[0] = 7;
  }
}

export const main = (): number => {
  const h = new Holder();
  h.poke();
  console.log(`${h.cells[0]} ${h.cells.length}`);
  return 0;
};
