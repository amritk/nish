// A task may not call the `wipe()` of a holder it is handed: the key is a
// field of shared memory.
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret([toU8(7), toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
const clear = (h: Holder): i32 => {
  h.wipe();
  return 0;
};
export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, h, out, 0);
  }
  return out[0];
};
