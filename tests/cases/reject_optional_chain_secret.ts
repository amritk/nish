// A `Secret` either operand of `??` makes is one nobody owns: `??` reads both
// operands as values rather than handing the one it answers to `k`, as a
// ternary's arms are, so each `Secret` here is refused, the one through the
// `?.` chain as the one beside it.
import { Secret, secret, wipe } from "nish:secret";

class Vault {
  open(): Secret<u8[]> {
    const bytes: u8[] = [1, 2, 3];
    return secret(bytes);
  }
}

const pick = (v: Vault | null): i32 => {
  const zero: u8[] = [0];
  const k = v?.open() ?? secret(zero);
  wipe(k);
  return 0;
};

export const main = (): i32 => pick(new Vault());
