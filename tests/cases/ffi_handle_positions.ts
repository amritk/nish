// WP40 H1.1: a well-formed handle class (§4a D1-D5, F, R1, R2, L1, L2) and the
// positions §4d allows it, as the checker sees them before any close is
// lowered. The one `CPtr | null` field is `readonly` and written once by the
// constructor from a `declare function`'s result (F); methods read it only as
// `this.file`, bound once to a `const` (R1) or passed straight to C (R2);
// `[Symbol.dispose]` names the close (§4b). A `File` is called (H1), lent to a
// parameter of its own type (H2) and lent on again from there (H3). No `new`
// and no `using`: opening one is H1.2's, so this program never makes a `File`,
// and `--emit-checked` shows the checked program the later stages lower.
// `Dir` is the other shape: a plain `CPtr` field, so its dispose is the bare
// `close(this.dir)` (§4b shape 1) and its method passes the field straight on.
// `Counter` is no handle: a `Dir` is lent to its method, and its own method
// named `closedir` is not the close `Dir` names.
class Counter {
  readonly n: i32
  constructor() {
    this.n = 0
  }
  closedir(): i32 {
    return this.n
  }
  count(d: Dir): i32 {
    return d.fd() + this.n
  }
}

declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
declare function feof(p: CPtr): i32
declare function opendir(path: string): CPtr
declare function closedir(p: CPtr): i32
declare function dirfd(p: CPtr): i32

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
  done(): boolean {
    const p = this.file
    return p === null || feof(p) !== 0
  }
  skip(count: i32): i32 {
    let seen = 0
    while (seen < count && !this.done()) {
      this.read()
      seen = seen + 1
    }
    return seen
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

class Dir {
  readonly dir: CPtr
  constructor(path: string) {
    this.dir = opendir(path)
  }
  fd(): i32 {
    return dirfd(this.dir)
  }
  [Symbol.dispose](): void {
    closedir(this.dir)
  }
}

const first = (f: File): i32 => f.read()

function descriptor(d: Dir): i32 {
  return d.fd()
}

function counted(d: Dir): i32 {
  const c = new Counter()
  return c.count(d)
}

function firstTwo(f: File, g: File): i32 {
  return first(f) + first(g)
}

const skipThenRead = (f: File, n: i32): i32 => {
  f.skip(n)
  return first(f)
}

export const main = (): i32 => 0
