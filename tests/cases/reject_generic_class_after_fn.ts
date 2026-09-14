// The other order, which is the same clash: a class or interface is collected
// before any function is, so the template is registered either way and the
// function is the declaration that is refused.
const Box = (x: i32): i32 => x;

class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

export const main = (): i32 => Box(1);
