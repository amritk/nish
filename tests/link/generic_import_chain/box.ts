// A template whose own body instantiates another module's template: the
// request chain crosses two module boundaries, and the fixed point the driver
// drains to is what finds `twice$i32` at all — `main.ts` never names it.
import { twice } from "./num";

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}

export const doubled = <T>(x: T, n: i32): i32 => twice(n);
