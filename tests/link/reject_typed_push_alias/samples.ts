// The other half of `main.ts`: a typed array behind an exported alias, as a
// return type, a field, a method's return type and an array of it.
export type Samples = Float64Array;
export type Rows = Samples[];

export const make = (n: i32): Samples => new Float64Array(n);
export const rows = (): Rows => [new Float64Array(2)];

export class Recorder {
  data: Samples;
  constructor() {
    this.data = new Float64Array(2);
  }
  latest(): Samples {
    return this.data;
  }
}
