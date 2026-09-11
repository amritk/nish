// WP15 §8, the false-positive guards for the dropped-allocation warning.
function build(n: i32): string {
  // The function hands the memory back, so its caller owns what it made and
  // there was never a scope here to lose (WP9's call-site reclaim is what
  // reclaims this one).
  let s = "a" + "b";
  s = s + "c";
  return s;
}

export function test(): number {
  // The rewrite the warning names: each value gets its own binding, and the
  // function gets its arena scope.
  const a = "x" + "y";
  const b = a + "z";

  // Declared holding a literal and then given its one value in a branch.
  // Assigning a local is how a language without a match expression computes a
  // value, no allocation is dropped, and there is nothing to rewrite.
  let what = "unbound";
  if (b.length > 2) {
    what = `long ${b}`;
  } else {
    what = `short ${b}`;
  }

  // Assigned something that is not an allocation at all: a string literal is
  // constant data.
  let s = "a" + "b";
  s = "literal";

  return b.length + what.length + s.length + build(1).length;
}
