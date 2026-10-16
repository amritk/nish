// `implements a.B` names a member access, not an interface. The type parser
// reads a dotted name since enum member types, so the checker refuses it by the
// rule `implements number[]` meets rather than the parser by a syntax error.
enum Kind {
  A,
}

class Point implements Kind.A {
  x: i32 = 0;
}

export const test = (): number => new Point().x;
