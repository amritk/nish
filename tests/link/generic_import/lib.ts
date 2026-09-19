// WP18 G7: the module that *declares* a template is the module that defines
// every instantiation of it. Nothing here names `Point`, and one of the
// instantiations `main.ts` asks for is `Box<Point>` — so the layout travels
// with the request and this module emits `%struct.Point` and a `Box$Point`
// built out of it.

export const identity = <T>(x: T): T => x;

export const firstOf = <T>(xs: T[]): T => xs[0];

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}
