// WP50 §5.1: a module that imports storage of a record and never names the
// record still reads and writes its fields: the import brings the layout in,
// as an imported function's signature does.
import { cells, total } from "./cells"

export const main = (): i32 => {
  cells[1].v = 4
  cells[1].w += 3
  cells[2].v = cells[1].v + cells[1].w
  cells[0].w = 2
  return total()
}
