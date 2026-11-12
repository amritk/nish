// WP27 S4.1: A field of a `declare class` embeds only another layout; an ordinary class is an arena object.
class Inner {
  x: i32
  constructor() {
    this.x = 0
  }
}

declare class Outer {
  inner: Inner
}

export const main = (): number => {
  return 0
}
