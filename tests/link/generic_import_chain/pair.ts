// The third module. `Pair<T>` is instantiated by `main.ts` and then handed to
// `box.ts` as a *type argument*, so `Box$Pair$i32`'s layout is computed in
// `box.ts` out of a struct neither `box.ts` nor `main.ts` declares.
export class Pair<T> {
  first: T;
  second: T;

  constructor(first: T, second: T) {
    this.first = first;
    this.second = second;
  }

  sum(): T {
    return this.first;
  }
}
