// A label is seen only by the function it is written in: the arrow's
// `break` cannot leave the loop around the arrow.
export function test(): number {
  let n = 0;
  outer: for (let i = 0; i < 3; i++) {
    const stop = (): void => {
      break outer;
    };
    stop();
    n += i;
  }
  return n;
}
