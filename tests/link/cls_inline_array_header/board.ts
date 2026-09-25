// The same program as `cls_inline_array_exported`, linked with `--emit-header`:
// the header writes a C struct for every class, so the build shares its
// layouts and `Board` keeps `nish_array *cells` even in a `--link` build.
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
