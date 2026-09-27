// #233, NL2377's reach: a `Result` local may be assigned again once its value
// has been read, and the check reads the function in source order rather than
// as a control-flow graph. A read in one branch of an `if` counts for the
// assignment after it, and a loop that reads the value before it replaces it
// is accepted. `reject_result_store_loop_unread` is the refused twin.
const parse = (n: i32): Result<i32, string> => (n > 0 ? Ok(n) : Err(`bad ${n}`));

const take = (r: Result<i32, string>): i32 => (r.isOk() ? r.value : -1);

export const main = (): i32 => {
  let total: i32 = 0;
  let r = parse(1);
  if (total === 0) {
    total = total + take(r);
  }
  r = parse(2);
  total = total + take(r);
  let s = parse(-3);
  let i: i32 = 0;
  while (i < 3) {
    total = total + take(s);
    s = parse(i);
    i++;
  }
  total = total + take(s);
  console.log(`${total}`);
  return 0;
};
