// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.

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

export class List {
  innerBenchmarkLoop(innerIterations: i32): boolean {
    for (let i = 0; i < innerIterations; i += 1) {
      if (!this.verifyResult(this.benchmark())) {
        return false;
      }
    }
    return true;
  }

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
      // The JavaScript version dereferences these unchecked; Nish makes the
      // null check explicit, which is what the VM does implicitly there.
      if (x === null || y === null || z === null) {
        panic("List: tail reached an empty list");
      }
      return this.tail(this.tail(x.next, y, z), this.tail(y.next, z, x), this.tail(z.next, x, y));
    }
    return z;
  }

  verifyResult(result: i32): boolean {
    return 10 === result;
  }
}
