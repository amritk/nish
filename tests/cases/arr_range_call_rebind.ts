// WP15 §2.4: the receiver's field is rebound between the proof and the call.
// `run` stores an array of six into `this.v` and could call `get(5)` with it
// proven, but `reset` stores `this.v = []` first, and its summary says it
// stores `v`, so the fact dies at that call and `get` keeps its check. The
// read panics with `index out of range: 5 >= 0`.
class Box {
  v: i32[];

  constructor() {
    this.v = [];
  }

  reset(): void {
    this.v = [];
  }

  get(i: i32): i32 {
    return this.v[i];
  }

  run(): void {
    this.v = new Array<i32>(6);
    console.log(`${this.get(5)}`);
    this.v = new Array<i32>(6);
    this.reset();
    console.log(`${this.get(5)}`);
  }
}

export const main = (): number => {
  new Box().run();
  return 0;
};
