// A generic class in another module implements `Cell`, so a `Cell` is a
// pointer to a class instance and storage cannot lay it inline.
import { Cell } from "./cells"

export class Box<T> implements Cell {
  v: i32 = 0
  t: T
  constructor(t: T) {
    this.t = t
  }
}
