// A field target is legal for `&= |= ^= <<= >>= >>>=` now, but `readonly`
// still means readonly: a derived class cannot rewrite a field its base
// declares, and the compound forms are not a way around the constructor rule
// (docs/LANGUAGE.md, Classes).
class Base {
  readonly mask: i32;
  constructor(m: i32) {
    this.mask = m;
  }
}

class Derived extends Base {
  constructor() {
    super(1);
  }

  add(bit: i32): void {
    this.mask |= bit;
  }
}

export function test(): number {
  const d = new Derived();
  d.add(2);
  return d.mask;
}
