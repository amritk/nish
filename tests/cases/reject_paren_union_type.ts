// The parentheses group, they do not widen: `(A | B)[]` is still the union
// `A | B`, and untagged `A` is refused as a variant with the message the
// unparenthesised form gets.
class A {
  x: i32 = 0;
}
class B {
  y: i32 = 0;
}
export function test(): number {
  const xs: (A | B)[] = [];
  return xs.length;
}
