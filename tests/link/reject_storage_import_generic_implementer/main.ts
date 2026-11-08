// WP50 §5.1: storage of an interface that a generic class in another module
// implements is refused. The clause binds only after imports do, so the
// storage check reads `implemented` once every module is bound.
import { cells } from "./cells"
import { Box } from "./box"

export const main = (): i32 => {
  const b = new Box<i32>(3)
  cells[0].v = 1
  return cells[0].v + b.v
}
