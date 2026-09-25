// Array fields stored inside their object (docs/LANGUAGE.md, "Fixed-length
// array fields are stored inline"). tests/layout/inline_array.c declares the
// same layout in C -- each inline field a `struct { nish_array h; T slots[K]; }`
// -- asserts its size and offsets with clang, and reads every slot and header
// through the pointers `make` hands back, so `self/structs.ts`'s arithmetic,
// `self/runtime.ts`'s `ARRAY_TYPE` and `runtime/nish.h`'s `nish_array` are held
// to one layout. Compiled with `-o` alone: a header would keep the pointer
// layout (`tests/cases/cls_inline_array_header`), and `Rows` is not exported,
// so nothing but this file's own C twin lays it out.
class Rows {
  flags: boolean[];
  count: i32;
  ids: i32[];
  tail: f64;
  names: string[];

  constructor() {
    this.flags = [false, true, false];
    this.count = 7;
    this.ids = new Array<i32>(5);
    this.tail = 0.5;
    this.names = ["a", "bc"];
  }

  setId(i: i32, v: i32): void {
    this.ids[i] = v;
  }
}

export const makeRows = (): Rows => {
  const r = new Rows();
  r.setId(4, 44);
  return r;
};
