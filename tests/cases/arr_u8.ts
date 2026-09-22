// A `u8[]` end to end: allocated, written, read back, and summed (WP30).
//
// The element type is what this case is for. A byte array is the payload shape
// a host hands a parser, and the whole reason `u8[]` can cross the interop
// boundary without marshalling is that `data` holds the bytes themselves —
// so the store, the load and the bounds check here are the same ones every
// other element width gets, at size 1.
//
// The sum widens with `toI32` at each element rather than accumulating in a
// `u8`: `u8` arithmetic wraps modulo 256, and 200 + 255 would be 199. That is
// the language's rule and not a quirk of arrays, but it is the mistake this
// case would otherwise invite, so it is spelled out.
function fill(bytes: u8[], v: u8): void {
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = v;
  }
}

function sum(bytes: u8[]): i32 {
  let total = 0;
  for (let i = 0; i < bytes.length; i++) {
    total = total + toI32(bytes[i]);
  }
  return total;
}

export function main(): i32 {
  const bytes = new Array<u8>(4);
  fill(bytes, 200);
  console.log(`${sum(bytes)}`);

  // The top of the range, element by element, so a sign-extended load would
  // show up as a negative total rather than as 765.
  bytes[0] = 255;
  bytes[1] = 255;
  bytes[2] = 255;
  bytes[3] = 0;
  console.log(`${sum(bytes)}`);

  // Wrapping is the element's own arithmetic: 255 + 1 is 0 in a `u8`.
  const one: u8 = 1;
  bytes[3] = bytes[0] + one;
  console.log(`${toI32(bytes[3])}`);
  return 0;
}
