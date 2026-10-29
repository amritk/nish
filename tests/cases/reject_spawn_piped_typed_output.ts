// The output arrays are appended to, so a typed-array spelling is refused for
// either one, as it is for `push`: its length is fixed, and the TypeScript
// the program is emitted to would throw on the append.
const make = (n: i32): Int32Array => new Int32Array(n);

export const main = (): i32 => {
  const none: u8[] = [];
  const err: u8[] = [];
  const fixed: Float64Array = new Float64Array(2);
  spawnPiped(["true"], none, make(4), err);
  return spawnPiped(["true"], none, err, fixed);
};
