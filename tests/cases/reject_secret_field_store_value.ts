// A field's store is a statement: its value bound to a local would be a
// second owner of the key, as `const x = this.k` is.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    const x = (this.k = secret([toU8(1), toU8(2)]));
    wipe(x);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const h = new Holder();
  h.wipe();
  return 0;
};
