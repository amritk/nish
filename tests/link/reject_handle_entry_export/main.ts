// WP89 S5a: a handle class is exported between Nish modules, never across
// the entry module's exports: those are C symbols, and a C caller that took
// a `File` would never close it.
declare function file_open(): CPtr
declare function file_close(p: CPtr): i32

export class File {
  readonly p: CPtr
  constructor() {
    this.p = file_open()
  }
  [Symbol.dispose](): void {
    file_close(this.p)
  }
}

export const main = (): i32 => {
  using f = new File()
  return 0
}
