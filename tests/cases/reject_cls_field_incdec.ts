// `++` and `--` take a mutable local; a field is not one, and the message
// names the rule rather than the field's type (docs/LANGUAGE.md, Expressions).
class Counter {
  n: i32 = 0;
}
export function test(): number {
  const c = new Counter();
  c.n++;
  return c.n;
}
