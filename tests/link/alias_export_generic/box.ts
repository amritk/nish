export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }
}

// An alias of an instantiation: `IntBox` is `Box<i32>`, instantiated in this
// module even when `main.ts` is the first to ask for it.
export type IntBox = Box<i32>;

export const wrap = (n: i32): IntBox => new Box<i32>(n);
