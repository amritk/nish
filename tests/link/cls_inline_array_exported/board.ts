// An exported class whose array field qualifies (docs/LANGUAGE.md, "Fixed-length
// array fields are stored inline"). In an IR-only build `export` keeps the
// pointer layout (`tests/cases/cls_inline_array_exported`); this program is
// its own final link, with no sidecar and no C, so nothing outside it can see
// `Board` and the field is stored inside the object.
export class Board {
  cells: i32[];

  constructor() {
    this.cells = [];
  }

  reset(): void {
    this.cells = new Array<i32>(4);
  }

  put(i: i32, v: i32): void {
    this.cells[i] = v;
  }
}
