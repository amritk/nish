// The parentheses group, they do not widen: `(A | B)[]` is still a union that
// is not `T | null`, and it is refused with the same message the unparenthesised
// form gets.
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
