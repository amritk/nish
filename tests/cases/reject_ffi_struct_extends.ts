// WP27 S4.1: A C struct layout is its own fields: no `extends` or `implements`.
declare class Base {
  y: i32
}

declare class Point extends Base {
  x: i32
}

export const main = (): number => {
  return 0
}
