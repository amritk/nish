// A variable assigned in an `else` arm keeps no narrowing from the null test
// after the `if`: `p` may be null again.
class P {
  v: i32 = 1;
}

const g = (q: P | null, r: P | null): i32 => {
  let p: P | null = q;
  if (p === null) {
    return 0;
  } else {
    p = r;
  }
  return p.v;
};

export const main = (): void => {
  console.log(g(new P(), null));
};
