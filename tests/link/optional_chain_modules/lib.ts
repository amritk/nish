// A generic function whose body is a `?.` chain, instantiated from another
// module: each instantiation is emitted in this module, and its null tests are
// the ones Phase 0 recorded for this module's own nodes.
export class Box<T> {
  item: T;
  next: Box<T> | null = null;
  constructor(item: T) {
    this.item = item;
  }
}

export const pad = (a: i32, b: i32, c: i32): i32 => a + b + c + a * b * c;

export const nextItem = <T>(b: Box<T> | null, fallback: T): T => b?.next?.item ?? fallback;

export const firstName = (b: Box<string> | null): string => b?.item ?? "none";
