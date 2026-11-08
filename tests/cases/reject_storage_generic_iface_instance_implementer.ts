// WP50 §5.1: a class implementing one instantiation of a generic interface,
// `Cell<i32>`, makes that interface a view, so module storage refuses it.
interface Cell<T> {
  v: T
}

class Box implements Cell<i32> {
  v: i32 = 0
}

const S = new Array<Cell<i32>>(4)

export const main = (): void => {
  S[0].v = 1
}
