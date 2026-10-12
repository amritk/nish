// The length of an array a helper builds and returns (`returnedLength` in
// `src/bounds.ts`). Each helper allocates a fresh array, touches nothing but
// its elements, and returns it, so the call starts the caller's array with
// the length the helper built it with — and every access below is proved.
const SIZE: i32 = 5;

const filled = (n: i32, v: i32): i32[] => {
  const arr = new Array<i32>(n);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = v;
  }
  return arr;
};

const sized = (): i32[] => {
  const arr = new Array<i32>(SIZE);
  arr[0] = 1;
  return arr;
};

const grown = (n: i32): i32[] => {
  const arr = new Array<i32>(n);
  arr.push(n);
  return arr;
};

const either = (wide: boolean): i32[] => {
  if (wide) {
    const arr = new Array<i32>(6);
    arr[5] = 6;
    return arr;
  }
  return [1, 2, 3, 4];
};

const weights = (n: i32): Float64Array => new Float64Array(n);

const sum8 = (): i32 => {
  const xs = filled(8, 2);
  let total = 0;
  for (let i = 0; i < 8; i++) {
    total = total + xs[i];
  }
  return total;
};

// A call this module cannot see into forgets every array length, so each
// helper's array is read before the next call.
const corners = (): i32 => {
  const ys = sized();
  const first = ys[0] + ys[4];
  const zs = grown(3);
  const second = zs[2];
  const ws = either(true);
  return first + second + ws[3];
};

class Board {
  rows: boolean[];

  constructor() {
    this.rows = [];
  }

  reset(): i32 {
    this.rows = filledFlags(8);
    let free = 0;
    for (let r = 0; r < 8; r++) {
      if (this.rows[r]) {
        free = free + 1;
      }
    }
    return free;
  }
}

const filledFlags = (n: i32): boolean[] => {
  const flags = new Array<boolean>(n);
  for (let i = 0; i < flags.length; i++) {
    flags[i] = true;
  }
  return flags;
};

export const main = (): number => {
  console.log(`${sum8()} ${corners()} ${new Board().reset()}`);
  const ws = weights(2);
  console.log(`${ws.length}`);
  return 0;
};
