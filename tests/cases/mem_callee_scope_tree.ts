// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

// The Storage shape from the Are We Fast Yet suite, with its manual
// `Arena.mark()` / `Arena.release(m)` taken out. `benchmark` has no arena
// allocation of its own: `new Random()` is an entry-block alloca, and the tree
// is built by the recursive `buildTreeDepth` and thrown away. Every parameter
// on the way down is an object of numbers (`Storage`, `Random`), so the tree
// cannot be stored anywhere that outlives the call, and `benchmark` reclaims it
// on return. Ten thousand runs leave `Arena.used()` where one run left it.
class Random {
  seed: i32 = 74755;

  next(): i32 {
    this.seed = (this.seed * 1309 + 13849) & 65535;
    return this.seed;
  }
}

class ArrayTree {
  children: (ArrayTree | null)[];

  constructor(children: (ArrayTree | null)[]) {
    this.children = children;
  }
}

class Storage {
  count: i32 = 0;

  benchmark(): i32 {
    const random = new Random();
    this.count = 0;
    this.buildTreeDepth(5, random);
    return this.count;
  }

  buildTreeDepth(depth: i32, random: Random): (ArrayTree | null)[] {
    this.count += 1;
    if (depth === 1) {
      return new Array<ArrayTree | null>((random.next() % 10) + 1);
    }
    const arr = new Array<ArrayTree | null>(4);
    for (let i = 0; i < 4; i += 1) {
      arr[i] = new ArrayTree(this.buildTreeDepth(depth - 1, random));
    }
    return arr;
  }
}

export const main = (): number => {
  const storage = new Storage();
  console.log(storage.benchmark());
  const after = Arena.used();
  for (let i = 0; i < 10000; i++) {
    storage.benchmark();
  }
  console.log(Arena.used() === after);
  return 0;
};
