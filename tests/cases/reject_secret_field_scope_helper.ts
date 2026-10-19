// A helper that ends a holder is a write to the holder too.
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
const end = (h: Holder): void => {
  h.wipe();
};
export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, h, out, 0);
    end(h);
  }
  return out[0];
};
