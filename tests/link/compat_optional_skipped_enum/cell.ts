// The enum and the class the entry's skipped call names, in a module of
// their own so the link checks a declare against its define.

export enum Kind {
  A,
  B,
}

export class Cell {
  n: i32 = 0;
  take(k: Kind): void {
    this.n += k === Kind.B ? 10 : 20;
  }
}
