// #233: an assignment moves a `Result` into a local, but the value it
// replaces is dropped. Overwriting a `Result` local whose value has not been
// read since it was last written is refused, so `parse(-1)`'s failure cannot
// vanish behind the `isErr()` test of the value that replaced it.
const parse = (n: i32): Result<i32, string> => (n > 0 ? Ok(n) : Err("negative"));

export const main = (): i32 => {
  let r = parse(-1);
  r = parse(1);
  if (r.isErr()) {
    return 1;
  }
  console.log(`${r.value}`);
  return 0;
};
