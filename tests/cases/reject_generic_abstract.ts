// There is no inheritance (WP25), so there is nothing an abstract class could
// be the base of; a generic one is refused in the same words as a declared one.
abstract class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}
