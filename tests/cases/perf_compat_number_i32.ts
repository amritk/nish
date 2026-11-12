// WP28 C0, NL9018: `--number-mode i32` beside the compatibility dialect is
// allowed and priced. The dialect's own number is the double a JavaScript
// engine computes with; asking for the 32-bit integer back keeps the strict
// dialect's arithmetic, overflow check and all, and the note says what that
// costs a program written for the other one.
const scale = (n: number): number => n * 3;

export function test(): number {
  return scale(14);
}
