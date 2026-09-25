// WP15 §2.4: a callee that resizes kills the fact across the call. `fill`
// proves `i < this.v.length` and then calls `shrink`, which pops through the
// same array, before `get(i)`: `shrink` has no summary, so the path fact dies
// at the call, `get` is entered knowing nothing about `this.v`, and keeps its
// check. The second pass reads `v[1]` of a one-element array and panics with
// `index out of range: 1 >= 1`.
class Stack {
  v: i32[];

  constructor() {
    this.v = [4, 5, 6];
  }

  shrink(): void {
    this.v.pop();
  }

  get(i: i32): i32 {
    return this.v[i];
  }

  fill(): void {
    let i = 0;
    while (i < this.v.length) {
      this.shrink();
      console.log(`${this.get(i)}`);
      i = i + 1;
    }
  }
}

export const main = (): number => {
  new Stack().fill();
  return 0;
};
