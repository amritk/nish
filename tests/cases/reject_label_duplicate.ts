// A label inside a statement with the same label would hide it.
export function test(): number {
  let n = 0;
  outer: for (let i = 0; i < 3; i++) {
    outer: for (let j = 0; j < 3; j++) {
      n += j;
    }
  }
  return n;
}
