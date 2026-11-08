// A record laid inline as storage, exported without its interface.
export interface Cell {
  v: i32
  w: i32
}

export const cells = new Array<Cell>(4)

/** The sum of two cells' fields, read where the storage is declared. */
export const total = (): i32 => cells[2].v + cells[0].w
