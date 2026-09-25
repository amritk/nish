// WP29: the two shapes a compile-time function parameter adds to the grammar,
// against the `typescript` parser node for node. A function type is read
// where a type goes and an arrow where an expression goes; the lines below
// hold every spelling of each, and the places the lookahead has to tell them
// apart from a parenthesised type or expression.
function apply(f: (x: number) => number, x: number): number {
  return f(x);
}

function pair(f: (a: number, b: number) => number, n: (string | null)[]): number {
  return f(1, 2) + n.length;
}

function twice(x: number): number {
  return x * 2;
}

function shapes(c: boolean, a: number, b: number): number {
  let x = apply(twice, a);
  x = apply((y) => y + 1, x);
  x = apply(y => y + 1, x);
  x = apply((y: number): number => y * y, x);
  x = apply((y: number) => {
    const z = y - 1;
    return z;
  }, x);
  x = c ? (a) : b;
  x = c ? (a + b) : (b);
  const names: (string | null)[] = [];
  names.push(null);
  return x + pair((p, q) => p + q, names);
}
