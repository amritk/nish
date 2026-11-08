// WP50 §5.1: storage of a generic interface's instantiation that a generic
// class in another module implements is refused, whether or not the class is
// instantiated before the storage is checked.
import { slots } from "./cells"
import { Holder } from "./holder"

export const main = (): i32 => {
  const h = new Holder<i32>(2)
  slots[0].v = 1
  return slots[0].v + h.v
}
