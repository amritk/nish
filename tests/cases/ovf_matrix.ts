// Checked signed arithmetic, every operator at both widths: `+ - *` and unary
// `-` with an operand read from a local, an array element and a field; `++`
// and `--` on a local; `+= -= *=` on a local, an element and a field.
//
// With no argument every operation lands one short of its limit and the sums
// print (ovf_matrix.out). With a case number as the argument that one
// operation goes one past instead, and the program panics with Rust's words,
// "attempt to add with overflow" and its siblings, and exits 1 before
// printing "after". tests/run.js runs every case and names the message each
// must print. The case numbers are `width * 23 + operation`, the operations in
// the order `checked32` lists them.
class Cell32 {
  v: i32;
  constructor(v: i32) {
    this.v = v;
  }
}

class Cell64 {
  v: i64;
  constructor(v: i64) {
    this.v = v;
  }
}

/** `2^63 - 1`, built from `2^62` because a literal past `2^53` cannot be written exactly. */
const max64 = (): i64 => {
  const half: i64 = toI64(1) << toI64(62);
  return half - toI64(1) + half;
};

/**
 * Operation `op` at `i32`, one past its limit when `bump` is 1 and one short
 * when it is 0. `bump` comes from the arguments, so that no constant folding
 * can see which.
 */
const checked32 = (op: i32, bump: i32): i32 => {
  const top: i32 = 2147483646 + bump; // INT_MAX when over, one below otherwise
  const bottom: i32 = -2147483647 - bump; // INT_MIN when over, one above otherwise
  const half: i32 = 1073741824 - 1 + bump; // 2^30 when over: doubled it passes INT_MAX
  const xs: i32[] = [top, bottom, half];
  const cell = new Cell32(top);
  const low = new Cell32(bottom);
  const big = new Cell32(half);
  switch (op) {
    case 0:
      return top + 1; // local
    case 1:
      return xs[0] + 1; // element
    case 2:
      return cell.v + 1; // field
    case 3:
      return bottom - 1;
    case 4:
      return xs[1] - 1;
    case 5:
      return low.v - 1;
    case 6:
      return half * 2;
    case 7:
      return xs[2] * 2;
    case 8:
      return big.v * 2;
    case 9:
      return -bottom - 1; // negating INT_MIN
    case 10:
      return -xs[1] - 1;
    case 11:
      return -low.v - 1;
    case 12: {
      let i: i32 = top;
      i++;
      return i;
    }
    case 13: {
      let i: i32 = bottom;
      i--;
      return i;
    }
    case 14: {
      let s: i32 = top;
      s += 1;
      return s;
    }
    case 15:
      xs[0] += 1;
      return xs[0];
    case 16:
      cell.v += 1;
      return cell.v;
    case 17: {
      let s: i32 = bottom;
      s -= 1;
      return s;
    }
    case 18:
      xs[1] -= 1;
      return xs[1];
    case 19:
      low.v -= 1;
      return low.v;
    case 20: {
      let s: i32 = half;
      s *= 2;
      return s;
    }
    case 21:
      xs[2] *= 2;
      return xs[2];
    case 22:
      big.v *= 2;
      return big.v;
  }
  return 0;
};

/** The same operations at `i64`, against `2^63 - 1` and `-2^63`. */
const checked64 = (op: i32, bump: i32): i64 => {
  const b: i64 = toI64(bump);
  const top: i64 = max64() - toI64(1) + b;
  const bottom: i64 = -max64() - b;
  const half: i64 = (toI64(1) << toI64(62)) - toI64(1) + b;
  const xs: i64[] = [top, bottom, half];
  const cell = new Cell64(top);
  const low = new Cell64(bottom);
  const big = new Cell64(half);
  const one: i64 = 1;
  const two: i64 = 2;
  switch (op) {
    case 0:
      return top + one;
    case 1:
      return xs[0] + one;
    case 2:
      return cell.v + one;
    case 3:
      return bottom - one;
    case 4:
      return xs[1] - one;
    case 5:
      return low.v - one;
    case 6:
      return half * two;
    case 7:
      return xs[2] * two;
    case 8:
      return big.v * two;
    case 9:
      return -bottom - one;
    case 10:
      return -xs[1] - one;
    case 11:
      return -low.v - one;
    case 12: {
      let i: i64 = top;
      i++;
      return i;
    }
    case 13: {
      let i: i64 = bottom;
      i--;
      return i;
    }
    case 14: {
      let s: i64 = top;
      s += one;
      return s;
    }
    case 15:
      xs[0] += one;
      return xs[0];
    case 16:
      cell.v += one;
      return cell.v;
    case 17: {
      let s: i64 = bottom;
      s -= one;
      return s;
    }
    case 18:
      xs[1] -= one;
      return xs[1];
    case 19:
      low.v -= one;
      return low.v;
    case 20: {
      let s: i64 = half;
      s *= two;
      return s;
    }
    case 21:
      xs[2] *= two;
      return xs[2];
    case 22:
      big.v *= two;
      return big.v;
  }
  return toI64(0);
};

export const main = (): i32 => {
  // The case to push over its limit, or -1 for none.
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : -1;
  let sum32: i32 = 0;
  let sum64: i64 = 0;
  for (let op: i32 = 0; op < 23; op++) {
    sum32 = sum32 ^ checked32(op, op === pick ? 1 : 0);
    sum64 = sum64 ^ checked64(op, op + 23 === pick ? 1 : 0);
  }
  console.log(`after: ${sum32} ${sum64}`);
  return 0;
};
