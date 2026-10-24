// WP40 H1.3, #566: `this` cannot be aliased in the handle class's own
// constructor: `const me = this` would give the half-built object a second
// name. The value rule refuses it at `this`; as in a method
// (`reject_ffi_handle_this_escapes`), not only by the constructor branch.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
    const me = this
  }
  read(): i32 {
    const p = this.file
    if (p === null) {
      return -1
    }
    return fgetc(p)
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
