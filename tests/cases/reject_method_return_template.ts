// A generic class's methods are collected once per instantiation, so a method
// with no return type is refused by the pass 1 sweep, which reads the
// template itself: nothing instantiates `Box`, and it is still refused.
export class Box<T> {
  value: i32 = 0;
  size() {
    return this.value;
  }
}
