// bench/awfy/permute.ts as it is, less its benchmark harness: an exported class
// in a module of its own, called from another module. A `--link` build is its
// own final link, so `export` only means "importable" and `Permute.swap` takes
// the facts its two call sites prove (`hostVisible` in `self/visibility.ts`).
// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.

export class Permute {
  count: i32 = 0;
  v: i32[];

  constructor() {
    this.v = [];
  }

  innerBenchmarkLoop(innerIterations: i32): boolean {
    for (let i = 0; i < innerIterations; i += 1) {
      if (!this.verifyResult(this.benchmark())) {
        return false;
      }
    }
    return true;
  }

  benchmark(): i32 {
    this.count = 0;
    this.v = new Array<i32>(6);
    this.permute(6);
    return this.count;
  }

  verifyResult(result: i32): boolean {
    return result === 8660;
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
