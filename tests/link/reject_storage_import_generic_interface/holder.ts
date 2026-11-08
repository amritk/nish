// A generic class in another module implements `Slot<T>`, so `Slot<i32>` is
// a pointer to a `Holder<i32>` once the class is instantiated.
import { Slot } from "./cells"

export class Holder<T> implements Slot<T> {
  v: T
  constructor(v: T) {
    this.v = v
  }
}
