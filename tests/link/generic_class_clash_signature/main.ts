// `generic_class_clash` with both instantiations made by a signature, so both
// exist before bodies are checked. The two `Box$i32` share a constructor and a
// method symbol, and those used to be reported, twice, as a clash of the class
// `Box<i32>`; the mistake is the template's name, and it is refused once, there.
import { fa, ma } from "./a";

class Box<T> {
  v: T;

  constructor(v: T) {
    this.v = v * 2;
  }

  get(): T {
    return this.v;
  }
}

const fb = (b: Box<i32>): i32 => b.get();

export const main = (): i32 => fa(ma()) + fb(new Box<i32>(1));
