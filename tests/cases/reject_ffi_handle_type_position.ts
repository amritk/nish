// WP40 H1.1, §4d: the general refusal of the type rule. The class name may be
// written only as the type of a parameter that borrows one; a local's
// annotation, as anywhere else, is refused by the one check.
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

const probe = (f: File): i32 => {
  let other: File | null = null
  return f.read()
}

export const main = (): i32 => 0
