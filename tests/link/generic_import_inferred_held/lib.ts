// #613, review round 1: `Box<T>` and the generic `box` that answers one. Both
// importers below reach `Box$i32` twice, and the first way in brings its
// layout without its methods.

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}

export const box = <T>(value: T): Box<T> => new Box<T>(value);
