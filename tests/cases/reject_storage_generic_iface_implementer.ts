// WP50 §5.1: a generic interface is a view once any class implements one of
// its instantiations, here a generic class implementing `Cell<T>`, so module
// storage refuses `Cell<i32>` as it refuses a plain interface a class
// implements.
interface Cell<T> {
  v: T
}

class Box<T> implements Cell<T> {
  v: T
  constructor(v: T) {
    this.v = v
  }
}

const S = new Array<Cell<i32>>(4)

export const main = (): void => {
  const b = new Box<i32>(1)
  S[0].v = b.v
}
