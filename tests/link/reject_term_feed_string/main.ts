// The key decoder reads bytes, as a terminal sends them: text is already
// decoded, so a lone ESC and the start of a split sequence are gone from it.
// A `string` where the `u8[]` goes is refused.
import { KeyDecoder } from "nish/term";

export const main = (): number => {
  const d = new KeyDecoder(toF64(30));
  const keys = d.feed("\x1b[A", 3, toF64(0));
  return keys.length;
};
