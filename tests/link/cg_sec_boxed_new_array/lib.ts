// The boxed field lives here so `main.ts` reaches it across a module
// boundary, as every `tests/link` program must.
export class Buf {
  bytes: u8[];

  constructor(n: i32) {
    this.bytes = new Array<u8>(n);
  }
}
