// WP27 S4.1: A C struct layout is its own fields, so it implements no interface.
interface HasX {
  x: i32
}

declare class Point implements HasX {
  x: i32
}

export const main = (): number => {
  return 0
}
