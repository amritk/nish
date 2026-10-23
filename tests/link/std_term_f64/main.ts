// `nish/term` under `--number-mode f64` (see `args`): the module spells every
// width it uses, so a program whose untyped numbers are doubles builds the same
// frame and decodes the same keys as the `i32` build in `std_term`. The values
// it passes are typed `i32` consts, because a bare literal is a `number` here.
import { ATTR_BOLD, COLOR_DEFAULT, Canvas, KeyDecoder, Screen, rgb } from "nish/term";
import { replaceAll } from "nish/text";

const W: i32 = 3;
const H: i32 = 1;
const ZERO: i32 = 0;
const ONE: i32 = 1;
const TWO: i32 = 2;
const FULL: i32 = 255;
const LETTER_A: i32 = 65;

export const main = (): i32 => {
  const s = new Screen(W, H, false);
  s.set(ZERO, ZERO, LETTER_A, rgb(FULL, ZERO, ZERO), COLOR_DEFAULT, ATTR_BOLD);
  console.log(replaceAll(s.flush(), "\x1b", "^["));
  const c = new Canvas(s);
  c.setPixel(ONE, ONE, rgb(ZERO, ZERO, FULL));
  console.log(replaceAll(s.flush(), "\x1b", "^["));
  const d = new KeyDecoder(30.0);
  const split: u8[] = [toU8(27)];
  const rest: u8[] = [toU8(91), toU8(68)];
  const first = d.feed(split, ONE, 0.0);
  const second = d.feed(rest, TWO, 5.0);
  console.log(`held ${first.length}, then kind ${second[0].kind} code ${second[0].code}`);
  return 0;
};
