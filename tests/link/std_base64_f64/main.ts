// `nish/base64` under `--number-mode f64` (see `args`): the module spells every
// width it uses, so a program whose untyped numbers are doubles encodes the
// same text as the `i32` build in `std_base64`. The values it passes are typed
// `i32` consts, because a bare literal is a `number` here.
import { base64Encode, base64EncodeInto, base64EncodedLength } from "nish/base64";

const ZERO: i32 = 0;
const OFF: i32 = 2;
const LEN: i32 = 5;
const AT: i32 = 3;
const SIZE: i32 = 14;
const DOT: i32 = 46;
const MOST: i32 = 1610612733;

export const main = (): i32 => {
  const src: u8[] = [];
  const text: string = "xxfoobayy";
  for (let i: i32 = ZERO; i < toI32(text.length); i++) {
    src.push(toU8(text.charCodeAt(i)));
  }
  console.log(base64Encode(src));
  const dst: u8[] = new Array<u8>(SIZE);
  dst.fill(toU8(DOT));
  const end: i32 = base64EncodeInto(src, OFF, LEN, dst, AT);
  console.log(`${end} ${String.fromBytes(dst, ZERO, SIZE)}`);
  console.log(`${base64EncodedLength(LEN)} ${base64EncodedLength(MOST)}`);
  return 0;
};
