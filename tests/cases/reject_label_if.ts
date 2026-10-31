// A label goes on a loop, a block or a `switch`; an `if` is not a target a
// `break` can name in Nish.
export function test(): number {
  let n = 0;
  check: if (n === 0) {
    n = 1;
  }
  return n;
}
