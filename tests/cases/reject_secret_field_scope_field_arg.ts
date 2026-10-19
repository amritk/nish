// Spawning on the field itself, not the holder, is still a read of the holder:
// its `wipe()` before the join would zero the key the task reads.
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
const workK = (k: Secret<u8[]>): i32 => expose(k, first);
export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(workK, h.k, out, 0);
    h.wipe();
  }
  return out[0];
};
