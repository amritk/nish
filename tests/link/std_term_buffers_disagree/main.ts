// A `Screen`'s eight cell buffers are one length, `width × height`, but they
// are public. A caller that grows one behind the screen's back, or shortens
// one, gets a flush of the cells every buffer holds: never a read past the end
// of the shorter ones, and never a panic.
import { Screen } from "nish/term";

const codes = (s: string): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < s.length; i++) {
    const c: i32 = s.charCodeAt(i);
    parts.push(c === 27 ? "ESC" : String.fromCharCode(c));
  }
  return parts.join(" ");
};

export const main = (): number => {
  const grown = new Screen(2, 1, false);
  grown.set(0, 0, 66, 7, 0, 0);
  grown.glyphs.push(65);
  console.log(`grown: ${codes(grown.flush())}`);
  const shortened = new Screen(3, 1, false);
  shortened.set(0, 0, 67, 7, 0, 0);
  shortened.set(2, 0, 68, 7, 0, 0);
  shortened.fgs.pop();
  console.log(`shortened: ${codes(shortened.flush())}`);
  return 0;
};
