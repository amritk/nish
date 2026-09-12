// The exporter: a class whose layout mentions an array. Every array operation in
// the program happens here, which is the point — see main.ts.
export class Bag {
  items: i32[];

  constructor() {
    this.items = [];
  }

  add(v: i32): i32 {
    this.items.push(v);
    return this.items.length;
  }
}
