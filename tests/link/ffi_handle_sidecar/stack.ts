// WP89 S5a: a library module of the root package whose exports take, give or
// are methods of a handle class. They link to `main.ts`, which imports them,
// but no C sidecar offers them: `c/probe.c` includes the generated header and
// declares each name with a type the header would contradict. `twice`, which
// names no handle, is still declared there, and the probe calls it.
import { Cell, cell_open, cell_read, cell_close } from "./sys"

/** A C cell this class owns and closes. */
export class Stack {
  readonly cell: Cell | null
  constructor(n: i32) {
    this.cell = cell_open(n)
  }
  depth(): i32 {
    const c = this.cell
    if (c === null) {
      return 0
    }
    return cell_read(c)
  }
  [Symbol.dispose](): void {
    const c = this.cell
    if (c !== null) {
      cell_close(c)
    }
  }
}

/** Opens a `Stack` `n` deep. */
export const openStack = (n: i32): Stack => {
  return new Stack(n)
};

/** How deep a borrowed `Stack` is. */
export const depth = (s: Stack): i32 => s.depth()

/** Twice `n`: a function the header still declares. */
export const twice = (n: i32): i32 => n * 2
