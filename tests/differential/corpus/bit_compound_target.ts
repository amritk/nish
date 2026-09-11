// `p.f op= e` and `a[i] op= e` for the six bitwise operators. JavaScript and
// Nish have to agree about three things at once here: the shift-count
// mask (`<<= 33` is a shift by one on both), the sign-filling of `>>` against
// the zero-filling of `>>>` on a negative value, and that the target
// expression is evaluated exactly once — which the counter `next()` bumps
// makes visible, because a target evaluated twice would print a different
// count on one side.
class Flags {
  bits: i32;
  count: i32;

  constructor() {
    this.bits = 0;
    this.count = 0;
  }

  next(): i32 {
    this.count += 1;
    return this.count - 1;
  }
}

export function main(): number {
  const f = new Flags();
  f.bits = -16;
  f.bits |= 3;
  console.log(f.bits);
  f.bits &= 255;
  console.log(f.bits);
  f.bits ^= 170;
  console.log(f.bits);
  f.bits <<= 33;
  console.log(f.bits);
  f.bits >>= 1;
  console.log(f.bits);
  f.bits = -256;
  f.bits >>>= 4;
  console.log(f.bits);

  // A variable count on an element target, across and past the width.
  for (let n = 0; n < 40; n++) {
    const b: i32[] = [1, -16];
    b[0] <<= n;
    b[1] >>= n;
    console.log(`${b[0]} ${b[1]}`);
  }

  const a: i32[] = [-16, 255, 1];
  a[f.next()] >>>= 2;
  a[f.next()] &= 60;
  a[f.next()] <<= 35;
  console.log(a[0]);
  console.log(a[1]);
  console.log(a[2]);
  console.log(f.count);
  return 0;
}
