// #233: `s = parse(i)` in the loop replaces `parse(-3)` before anything has
// read it, so its failure would vanish; NL2377 refuses the assignment.
// `res_result_store_flow` has the loop that reads `s` first, and compiles.
const parse = (n: i32): Result<i32, string> => (n > 0 ? Ok(n) : Err(`bad ${n}`));

const take = (r: Result<i32, string>): i32 => (r.isOk() ? r.value : -1);

export const main = (): i32 => {
  let s = parse(-3);
  let i: i32 = 0;
  while (i < 3) {
    s = parse(i);
    i++;
  }
  return take(s);
};
