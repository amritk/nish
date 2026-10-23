// A `Screen`'s eight cell buffers are one length, `width × height`, and
// `flush` reads them all by one index. A caller that grows one of them behind
// the screen's back gets a panic naming the screen, not a frame read past the
// end of the shorter ones.
import { Screen } from "nish/term";

export const main = (): number => {
  const s = new Screen(2, 1, false);
  s.glyphs.push(65);
  console.log(s.flush());
  return 0;
};
