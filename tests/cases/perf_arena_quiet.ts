// WP15 §8, the false-positive guards for the dropped-allocation warning.
class Box {
  inner: string;
  constructor(inner: string) {
    this.inner = inner;
  }
}

class Chain {
  prev: Chain | null;
  constructor(prev: Chain | null) {
    this.prev = prev;
  }
}

class Wrap {
  box: Box;
  constructor(box: Box) {
    this.box = box;
  }
}
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

  // A template with no hole is a literal: nothing is allocated and nothing is
  // dropped. Stage0 spells this `ts.isTemplateExpression`; stage1 has to ask
  // whether any part is a hole, because its parser gives both forms one kind.
  let plain = `hello`;
  plain = `world`;

  // Captured before the assignment, and in a loop, so control comes back
  // around with the capture behind it: every value this drops is still
  // reachable through `rows`, and the `const` rewrite does not apply.
  const rows: string[] = [];
  let row = "a" + "b";
  for (let i = 0; i < 2; i = i + 1) {
    rows.push(row);
    row = "c" + "d";
  }

  // Handed to the constructor of the value that replaces it, so the old value
  // lives on inside the new one: a constructor argument is a capture.
  let box = new Box(`${b}!`);
  const wrapped = new Wrap(box);
  box = new Box(wrapped.box.inner);

  // Outside any loop the same holds for the assignment's own right-hand side:
  // the new link keeps the old one.
  let chain = new Chain(null);
  chain = new Chain(chain);

  return (
    b.length +
    what.length +
    s.length +
    build(1).length +
    plain.length +
    rows.length +
    row.length +
    box.inner.length +
    (chain.prev !== null ? 1 : 0)
  );
}
