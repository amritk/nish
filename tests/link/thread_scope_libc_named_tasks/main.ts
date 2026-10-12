// #610: a task the program names after a C library function. A private
// function handed to `spawn`, or to any template another module instantiates,
// is `hidden` rather than `internal`, so its symbol is global in the
// executable. Spelled `read`, the runtime's own `read(2)` bound to it: the
// pool's first start reads `/proc/self/cgroup`, which a join of two tasks
// reaches and a join of one does not, and it called `read(l)` with a file
// descriptor for `l` and crashed. `write` took `console.log`'s output, and
// `free` the join's release of each task. Such a symbol now ends with a `$`,
// which C cannot spell.
//
// Each scope below joins two tasks: the same object twice, two objects, two
// entry functions, and an object beside an array. The map body is `close`,
// the other template that takes a private function.
import { parallelMapInto, scope } from "nish/threads";

class Leaf {
  x: i32 = 0;
}

const read = (l: Leaf): i32 => l.x;

const write = (l: Leaf): i32 => l.x * 10;

const free = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const close = (n: i32): i32 => n * n;

export const main = (): i32 => {
  const a = new Leaf();
  a.x = 3;
  const b = new Leaf();
  b.x = 4;
  const xs: i32[] = [1, 2, 3];

  const same: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(read, a, same, 0);
    s.spawn(read, a, same, 1);
  }
  console.log(`same object: ${same[0]} ${same[1]}`);

  const two: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(read, a, two, 0);
    s.spawn(read, b, two, 1);
  }
  console.log(`two objects: ${two[0]} ${two[1]}`);

  const entries: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(read, a, entries, 0);
    s.spawn(write, b, entries, 1);
  }
  console.log(`two entries: ${entries[0]} ${entries[1]}`);

  const mixed: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(write, a, mixed, 0);
    s.spawn(free, xs, mixed, 1);
  }
  console.log(`object and array: ${mixed[0]} ${mixed[1]}`);

  const ns: i32[] = [1, 2, 3, 4];
  const squares: i32[] = [0, 0, 0, 0];
  parallelMapInto(ns, squares, close);
  console.log(`map: ${squares[0]} ${squares[1]} ${squares[2]} ${squares[3]}`);
  return 0;
};
