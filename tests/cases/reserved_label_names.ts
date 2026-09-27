// Issue #266: LLVM names a function's arguments, blocks and allocas in one
// namespace, so a parameter spelled like a name the emitter writes itself is
// written `%<name>.param`: `entry`, the block every function opens with, and
// `chr`, the byte `String.fromCharCode` allocates. A local keeps its
// `%<name>.addr` slot, which collides with nothing.
const next = (entry: i32): i32 => entry + 1;

const counted = (): i32 => {
  let entry = 4;
  entry += 1;
  return entry;
};

const letter = (chr: i32): string => String.fromCharCode(chr);

const parse = (n: i32): Result<i32, boolean> => (n < 0 ? Err(false) : Ok(n));

// A `Result` small enough to pack is unpacked from the parameter in the prologue.
const orZero = (entry: Result<i32, boolean>): i32 => entry.unwrapOr(0);

class Tally {
  entry: i32;

  constructor(entry: i32) {
    this.entry = entry;
  }

  plus(entry: i32): i32 {
    return this.entry + entry;
  }
}

export const main = (): number => {
  console.log(next(1));
  console.log(counted());
  console.log(letter(65));
  console.log(orZero(parse(7)));
  console.log(new Tally(2).plus(3));
  return 0;
};
