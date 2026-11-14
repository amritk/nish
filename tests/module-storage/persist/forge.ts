// WP55 root storage under a page that forges the kept graph (WH-10,
// docs/security/wasm-host.md): tests/persist/drive.mjs, forge, finds the
// root's cell by its magic word, rewrites a root slot, a pointer field or an
// array's length and cap in linear memory, then calls `churn`, whose garbage
// makes the keep after it compact. The trace must refuse each forgery with a
// panic before it reads or rewrites a byte outside the arena.

class Cell {
  magic: i32 = 0
  names: string[]
  next: Cell | null = null

  constructor(magic: i32) {
    this.magic = magic
    this.names = []
  }
}

const cells = new Array<Cell | null>(1)
const trash = new Array<Cell | null>(1)

/** The cell the page looks for, holding four names and a second cell. */
export function init(): void {
  // Garbage first, so the cell's address is not also the arena's base, a
  // word the page's search for the root slot would find too.
  const pad = new Cell(0)
  pad.magic = 1
  const c = new Cell(1592594996)
  for (let i = 0; i < 4; i++) {
    c.names.push(`n${i}`)
  }
  c.next = new Cell(1592615544)
  cells[0] = c
}

/**
 * Garbage past the keep's 64 KiB of slack, so the keep after this call
 * compacts. It passes through storage first: a call whose allocations reach
 * no root gives its arena back on return and leaves the keep nothing to do.
 */
export function churn(): i32 {
  const junk = new Cell(0)
  for (let i = 0; i < 40000; i++) {
    junk.names.push("x")
  }
  trash[0] = junk
  trash[0] = null
  return junk.names.length
}

/** How many names the cell holds, and the first's length: 4 and 2 untouched. */
export function names(): i32 {
  const c = cells[0]
  if (c === null) {
    return -1
  }
  return c.names.length * 10 + c.names[0].length
}
