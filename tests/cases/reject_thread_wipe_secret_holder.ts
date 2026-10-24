// A task may wipe a `Secret` it makes and holds in a `const`, but not one a
// holder it makes keeps in a field: the field is written by the constructor,
// and what a constructor stores is not followed. Hold the `Secret` in a local.
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
class Holder {
  readonly k: Secret<u8[]>;
  constructor(n: i32) {
    this.k = secret([toU8(n), toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
const clear = (n: i32): i32 => {
  const h = new Holder(n);
  h.wipe();
  return 0;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, 4, out, 0);
  }
  return out[0];
};
