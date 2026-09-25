// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.

import { Random } from "./som";

// Nish arrays hold one element type and a type cannot name itself without a
// class, so each inner slot holds an `ArrayTree` wrapping the child array. The
// leaves are still arrays of `null`s, like `new Array(n)` in the JavaScript.
class ArrayTree {
  children: (ArrayTree | null)[];

  constructor(children: (ArrayTree | null)[]) {
    this.children = children;
  }
}

export class Storage {
  count: i32 = 0;

  innerBenchmarkLoop(innerIterations: i32): boolean {
    for (let i = 0; i < innerIterations; i += 1) {
      if (!this.verifyResult(this.benchmark())) {
        return false;
      }
    }
    return true;
  }

  benchmark(): i32 {
    const random = new Random();
    this.count = 0;
    // There is no GC to collect the tree, and no `Arena` call here either: the
    // tree is dead once it is built, so the compiler brackets this method with
    // an arena scope of its own and hands the tree back on return, as the C++
    // port does with `delete[]` (docs/LANGUAGE.md, the automatic arena scope).
    this.buildTreeDepth(7, random);
    return this.count;
  }

  verifyResult(result: i32): boolean {
    return 5461 === result;
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
