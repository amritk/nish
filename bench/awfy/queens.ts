// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.

export class Queens {
  freeRows: boolean[];
  freeMaxs: boolean[];
  freeMins: boolean[];
  queenRows: i32[];

  constructor() {
    this.freeRows = [];
    this.freeMaxs = [];
    this.freeMins = [];
    this.queenRows = [];
  }

  innerBenchmarkLoop(innerIterations: i32): boolean {
    for (let i = 0; i < innerIterations; i += 1) {
      if (!this.verifyResult(this.benchmark())) {
        return false;
      }
    }
    return true;
  }

  benchmark(): boolean {
    let result = true;
    for (let i = 0; i < 10; i += 1) {
      result = result && this.queens();
    }
    return result;
  }

  verifyResult(result: boolean): boolean {
    return result;
  }

  queens(): boolean {
    this.freeRows = filledBooleans(8);
    this.freeMaxs = filledBooleans(16);
    this.freeMins = filledBooleans(16);
    this.queenRows = filledMinusOne(8);

    return this.placeQueen(0);
  }

  placeQueen(c: i32): boolean {
    for (let r = 0; r < 8; r += 1) {
      if (this.getRowColumn(r, c)) {
        this.queenRows[r] = c;
        this.setRowColumn(r, c, false);

        if (c === 7) {
          return true;
        }

        if (this.placeQueen(c + 1)) {
          return true;
        }
        this.setRowColumn(r, c, true);
      }
    }
    return false;
  }

  getRowColumn(r: i32, c: i32): boolean {
    return this.freeRows[r] && this.freeMaxs[c + r] && this.freeMins[c - r + 7];
  }

  setRowColumn(r: i32, c: i32, v: boolean): void {
    this.freeRows[r] = v;
    this.freeMaxs[c + r] = v;
    this.freeMins[c - r + 7] = v;
  }
}

// Nish has no `Array.prototype.fill`, so these stand in for
// `new Array(n).fill(true)` and `new Array(n).fill(-1)`.
const filledBooleans = (n: i32): boolean[] => {
  const arr = new Array<boolean>(n);
  for (let i = 0; i < arr.length; i += 1) {
    arr[i] = true;
  }
  return arr;
};

const filledMinusOne = (n: i32): i32[] => {
  const arr = new Array<i32>(n);
  for (let i = 0; i < arr.length; i += 1) {
    arr[i] = -1;
  }
  return arr;
};
