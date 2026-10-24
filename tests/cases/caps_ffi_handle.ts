// WP40 H1.2: a `using` of a handle class is `ffi` at the `using` itself: its
// block calls the close `[Symbol.dispose]` names at every exit. The report keeps
// the shortest chain per capability, so `main`'s witness is that close, called
// at the `using` line (distance 0), rather than the constructor's `fopen` the
// same `new` reaches one call deeper.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  read(): i32 {
    const p = this.file
    if (p === null) {
      return -2
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

export const main = (): number => {
  using f = new File("/dev/null")
  console.log(f.read())
  return 0
}
