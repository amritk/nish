// Root storage keeps only what the runtime can trace: a handle class owns a
// C resource the runtime cannot move.
declare function fopen(path: string, mode: string): CPtr | null

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
}

class Log {
  out: File

  constructor() {
    this.out = new File("/dev/null")
  }
}

const log = new Array<Log | null>(1)

export const open = (): boolean => log[0] !== null
