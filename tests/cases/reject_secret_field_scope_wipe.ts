// The parent may not call a holder's `wipe()` while a task of the scope may
// still read the key: natively the task would run after the wipe, at the join.
import { Secret, expose, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const first = (k: u8[]): i32 => toI32(k[0]);
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret([toU8(7), toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
const work = (h: Holder): i32 => expose(h.k, first);
export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, h, out, 0);
    h.wipe();
  }
  return out[0];
};
