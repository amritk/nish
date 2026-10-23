// WP40 H1.1, Row 19: a handle class is never exported, so no other module can
// name it.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
export class File {
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

export const main = (): i32 => 0
