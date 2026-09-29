// An imported array alias is the array type it names: a `u8[]` literal is a
// `Bytes`, `.length` and `.push` are an array's, and a `Samples` is read-only
// here as it is in `bytes.ts`.
import { Byte, Bytes, checksum, Samples } from "./bytes";

const fill = (n: i32): Bytes => {
  const out: Bytes = [];
  for (let i: i32 = 0; i < n; i++) {
    const b: Byte = toU8(i * 3);
    out.push(b);
  }
  return out;
};

const largest = (s: Samples): i32 => {
  let best = s[0];
  for (const v of s) {
    if (v > best) {
      best = v;
    }
  }
  return best;
};

export const main = (): number => {
  const data = fill(10);
  const s: Samples = [4, 9, 2];
  console.log(`${data.length} ${checksum(data)} ${largest(s)}`);
  return checksum([toU8(1), toU8(2)]) === 3 ? 0 : 1;
};
