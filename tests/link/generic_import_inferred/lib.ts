// #613: `box` answers a `Box<T>`, and `main.ts` binds what it answers with no
// annotation, so `Box<i32>` is named in that module by nothing but the call.
// This module defines `Box$i32` and its methods, as it defines every
// instantiation of a template it declares.

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

export const unbox = <T>(b: Box<T>): T => b.get();
