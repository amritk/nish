// WP15 §2a: source order is not execution order in a loop. `b` is read before
// the `push` on the first pass and after it on every later one, so the loop is
// pre-scanned and the reference is invalid from the moment the loop starts.
interface Body {
  m: number;
}

export const test = (): number => {
  const bodies: Body[] = [{ m: 1 }];
  const b = bodies[0];
  let i = 0;
  while (i < 3) {
    b.m = b.m + 1;
    bodies.push({ m: i });
    i = i + 1;
  }
  return b.m;
};
