// WP15 §2.4: a parameter used as an index is proven in range when every call
// site proves it for the same array. This is AWFY Permute with its class not
// exported, so that every call to `swap` is one the compiler sees. `benchmark`
// stores an array of six into `this.v` and calls `permute(6)`; `permute` counts
// `n` down, so `n1 = n - 1` is in [0, 6) and the loop's `i` in [0, n1]; and
// `permute` and `swap` store no field `v` and resize nothing, so `this.v`
// keeps its six elements across every call. The golden has no
// `nish_panic_index` in `Permute.swap`.
class Permute {
  count: i32 = 0;
  v: i32[];

  constructor() {
    this.v = [];
  }

  benchmark(): i32 {
    this.count = 0;
    this.v = new Array<i32>(6);
    this.permute(6);
    return this.count;
  }

  permute(n: i32): void {
    this.count += 1;
    if (n !== 0) {
      const n1 = n - 1;
      this.permute(n1);
      for (let i = n1; i >= 0; i -= 1) {
        this.swap(n1, i);
        this.permute(n1);
        this.swap(n1, i);
      }
    }
  }

  swap(i: i32, j: i32): void {
    const tmp = this.v[i];
    this.v[i] = this.v[j];
    this.v[j] = tmp;
  }
}

export const main = (): number => {
  const p = new Permute();
  console.log(`${p.benchmark()}`);
  return 0;
};
