// A task, and a parallel body, may write memory only it can reach: an array it
// allocates itself, keeps in a `const`, and hands to nothing that keeps it. A
// sieve fills its own table, a helper fills the array it is handed, a filter
// pushes onto its own list, and a map body takes its element apart into a
// scratch array of a length it computes, so none is promoted to the stack.
// Each array is zeroed with `fill` before it is read, as Node needs.
// Each runs on threads of its own natively and one after another under Node,
// and both print the same, because nothing one of them writes is anything
// another can read. #564's `new` is here too: a constructor that sets only its
// own fields may run between a scope's first `spawn` and its join.
import { parallelMapInto, scope } from "nish/threads";

const sieve = (n: i32): i32 => {
  const marks = new Array<i32>(n);
  marks.fill(0);
  let count: i32 = 0;
  for (let i: i32 = 2; i < toI32(marks.length); i++) {
    if (marks[i] === 0) {
      count = count + 1;
      for (let j: i32 = i * 2; j < toI32(marks.length); j = j + i) {
        marks[j] = 1;
      }
    }
  }
  return count;
};

const fill = (xs: i32[], v: i32): void => {
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    xs[i] = v + i;
  }
};

const total = (n: i32): i32 => {
  const xs = new Array<i32>(n);
  fill(xs, 3);
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const evens = (n: i32): i32 => {
  const xs: i32[] = [];
  for (let i: i32 = 0; i < n; i++) {
    if (i % 2 === 0) {
      xs.push(i);
    }
  }
  return toI32(xs.length);
};

const digitSum = (x: i32): i32 => {
  const ds = new Array<i32>((x % 7) + 4);
  ds.fill(0);
  let v = x;
  let k: i32 = 0;
  while (v > 0 && k < toI32(ds.length)) {
    ds[k] = v % 10;
    v = toI32(v / 10);
    k = k + 1;
  }
  let t: i32 = 0;
  for (const d of ds) {
    t = t + d;
  }
  return t;
};

class Point {
  x: i32;
  y: i32;

  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export const main = (): i32 => {
  const primes: i32[] = [0, 0];
  const sums: i32[] = [0];
  const counts: i32[] = [0];
  let far: i32 = 0;
  {
    using s = scope();
    s.spawn(sieve, 100, primes, 0);
    s.spawn(sieve, 10000, primes, 1);
    s.spawn(total, 10, sums, 0);
    s.spawn(evens, 101, counts, 0);
    const p = new Point(3, 4);
    far = p.x * p.x + p.y * p.y;
  }
  const src: i32[] = [12, 345, 6789, 10, 99999, 7];
  const dst: i32[] = [0, 0, 0, 0, 0, 0];
  parallelMapInto(src, dst, digitSum);
  console.log(`${primes[0]} ${primes[1]} ${sums[0]} ${counts[0]} ${far}`);
  console.log(`${dst[0]} ${dst[1]} ${dst[2]} ${dst[3]} ${dst[4]} ${dst[5]}`);
  return 0;
};
