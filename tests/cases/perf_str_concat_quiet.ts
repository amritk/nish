// WP15 §8, the false-positive guards for the quadratic-string warning. Every
// concatenation here is linear, so the compiler must say nothing at all: a
// warning with no faster form to name is what trains people to ignore the
// class.
export function test(): number {
  const parts = ["a", "bb", "ccc"];

  // The result does not include the target, so each pass allocates one bounded
  // string and the loop is linear.
  let line = "";
  for (const part of parts) {
    line = part + "!";
  }

  // The accumulator is declared inside the loop, so it is reset every pass.
  let total = 0;
  for (let i = 0; i < 3; i = i + 1) {
    let piece = "";
    piece = piece + "x";
    total = total + piece.length;
  }

  // Outside any loop: one copy, once.
  let head = "a";
  head = head + "b";

  // The `for` initializer runs once, so `x` is a per-loop binding of a `for...of`
  // and not an accumulator either.
  let seen = 0;
  for (const x of parts) {
    seen = seen + x.length;
  }

  return line.length + total + head.length + seen;
}
