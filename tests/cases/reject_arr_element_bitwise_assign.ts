// The same rule for an element target: `a[i] &= v` would need a load, an
// operation and a store through the element address, and only the local form
// exists (docs/LANGUAGE.md, Expressions).
export function test(): number {
  const a: i32[] = [6];
  a[0] &= 3;
  return a[0];
}
