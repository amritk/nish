// WP40 H1.2: under `--deny ffi`, a `using` of a handle class is refused at the
// `using`'s `new`, whose block calls the close, as well as at the constructor's
// `fopen`.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
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
  return 0
}
