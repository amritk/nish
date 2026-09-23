// WP18 G6 across a module boundary: both constraints name a type in this
// module, and each template carries its constraint wherever it is imported.
// `main.ts` instantiates them, so the requests are checked there, against the
// constraints resolved here, and every instantiation is defined here.
export interface Shape {
  area: i32;
}

export class Counter {
  count: i32;

  constructor(start: i32) {
    this.count = start;
  }

  bump(): i32 {
    this.count = this.count + 1;
    return this.count;
  }
}

export const areaOf = <T extends Shape>(shape: T): i32 => shape.area;

export const twice = <T extends Counter>(c: T): i32 => {
  c.bump();
  return c.bump();
};
