// A constant table cannot fill a mutable `T[]` field of an interface.
const TAB: readonly i32[] = [1, 2, 3]

interface Row {
  cells: i32[]
}

export const main = (): void => {
  const r: Row = { cells: TAB }
  console.log(`${r.cells.length}`)
}
