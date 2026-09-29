// WP34 N3: `crypto.getRandomValues(bytes)` fills every byte of a u8[] from the
// kernel's CSPRNG. Two 32-byte draws that agree would be a broken source (the
// chance is 2^-256), an empty array is a call that fills nothing, and 65,536
// bytes, the Web API's limit for one call, is allowed. The `os_` block of
// tests/run.js runs this twice with an argument, and requires the draws of the
// two runs to differ as well.
const DIGITS: string = "0123456789abcdef";

const hex = (b: u8[]): string => {
  const parts: string[] = [];
  for (const x of b) {
    const v = toI32(x);
    parts.push(DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

// The array is a parameter the call writes through, so it must not be
// declared `readonly` in the IR.
const draw = (into: u8[]): void => {
  crypto.getRandomValues(into);
};

export const main = (): i32 => {
  const a = new Array<u8>(32);
  const b = new Array<u8>(32);
  draw(a);
  crypto.getRandomValues(b);
  console.log(hex(a) !== hex(b));
  const empty = new Array<u8>(0);
  crypto.getRandomValues(empty);
  console.log(empty.length);
  const most = new Array<u8>(65536);
  crypto.getRandomValues(most);
  console.log(most.length);
  const key: u8[] = [0, 0, 0, 0];
  crypto.getRandomValues(key);
  console.log(key.length);
  if (process.argv.length > 1) {
    console.log(hex(a));
    console.log(hex(b));
  }
  return 0;
};
