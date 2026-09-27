// #233: `r2 = r1` moves the `Result` into `r2` rather than dropping it, so it
// is not a discard, but `r2` must still be inspected: the responsibility moves
// with the value.
const parse = (n: i32): Result<i32, string> => (n < 0 ? Err("negative") : Ok(n));

export const main = (): i32 => {
  let r2 = parse(1);
  const r1 = parse(-1);
  r2 = r1;
  return 0;
};
