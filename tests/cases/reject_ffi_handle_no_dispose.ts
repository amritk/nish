// WP40 H1.1, Row 30: a class owning a C pointer names its close, or every exit
// would leak it.
declare function fopen(path: string, mode: string): CPtr | null
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
}

export const main = (): i32 => 0
