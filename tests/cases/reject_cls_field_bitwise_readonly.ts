// A field target is legal for `&= |= ^= <<= >>= >>>=` now, but `readonly`
// still means readonly, and the compound forms are not a way around the
// constructor rule: `|=` reads the field and writes it back, so it is a write
// like any other, refused in the declaring class's own constructor as much as
// anywhere else (docs/LANGUAGE.md, Classes).
class Flags {
  readonly mask: i32;

  constructor(m: i32) {
    this.mask = m;
    this.mask |= 1;
  }
}

export function test(): number {
  return new Flags(2).mask;
}
