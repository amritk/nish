// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

// An automatic arena scope for a function whose callees are what allocate.
// `benchmark` allocates nothing itself: `makeList` builds three lists, `tail`
// hands one of them back, and all `benchmark` keeps is an `i32`. It is
// `List.benchmark` from the Are We Fast Yet suite. `List` has no field a
// pointer fits in, so nothing the call allocates can be stored anywhere that
// outlives it, and `benchmark` brackets itself with `nish_arena_mark` /
// `nish_arena_release`. The escape analysis alone would not prove it, because
// `tail` returns its argument and that counts as a capture.
class Element {
  val: i32;
  next: Element | null = null;

  constructor(v: i32) {
    this.val = v;
  }

  length(): i32 {
    const next = this.next;
    if (next === null) {
      return 1;
    }
    return 1 + next.length();
  }
}

class List {
  benchmark(): i32 {
    const result = this.tail(this.makeList(15), this.makeList(10), this.makeList(6));
    if (result === null) {
      panic("List: tail returned an empty list");
    }
    return result.length();
  }

  makeList(length: i32): Element | null {
    if (length === 0) {
      return null;
    }
    const e = new Element(length);
    e.next = this.makeList(length - 1);
    return e;
  }

  isShorterThan(x: Element | null, y: Element | null): boolean {
    let xTail = x;
    let yTail = y;
    while (yTail !== null) {
      if (xTail === null) {
        return true;
      }
      xTail = xTail.next;
      yTail = yTail.next;
    }
    return false;
  }

  tail(x: Element | null, y: Element | null, z: Element | null): Element | null {
    if (this.isShorterThan(y, x)) {
      if (x === null || y === null || z === null) {
        panic("List: tail reached an empty list");
      }
      return this.tail(this.tail(x.next, y, z), this.tail(y.next, z, x), this.tail(z.next, x, y));
    }
    return z;
  }
}

export const main = (): number => {
  const list = new List();
  console.log(list.benchmark());
  // A thousand more calls leave the arena exactly where one left it.
  const before = Arena.used();
  let same = true;
  for (let i = 0; i < 1000; i++) {
    same = same && list.benchmark() === 10;
  }
  console.log(same);
  console.log(Arena.used() === before);
  return 0;
};
