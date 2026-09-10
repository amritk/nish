// A bare literal takes a parameter's type for a function and for a
// constructor; a method is neither, and `docs/LANGUAGE.md`'s table is the whole
// list. So in f64 mode the `-1` here is an f64 meeting an `i32` and wants
// `toI32(-1)`. stage1 was threading the parameter type down to it and
// compiling a program stage0 refuses (WP19 §A3).
class Box {
  v: i32 = 0;
  get(fallback: i32): i32 {
    return this.v === 0 ? fallback : this.v;
  }
}

export function main(): i32 {
  const b = new Box();
  return b.get(-1);
}
