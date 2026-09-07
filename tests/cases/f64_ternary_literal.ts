// A literal in a ternary arm takes the type its context wants, the same way
// a literal directly in the annotated initializer does. Without the rule the
// two arms below are `i32` literals in i32 mode and the file does not compile.
function pick(flag: boolean): f64 {
  const scale: f64 = flag ? 2147483648.0 : 0.5;
  return scale;
}

function widen(flag: boolean, x: i64): i64 {
  return flag ? x : 5;
}

export function test(): number {
  const wide = widen(false, toI64(1));
  return pick(false) < 1.0 && wide === toI64(5) ? 7 : 0;
}
