// Rule 1: a call that answers a `Result` may not stand as an expression
// statement, because that is exactly where a failure would vanish.
const mayFail = (n: i32): Result<i32, string> => {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
};

export const main = (): i32 => {
  mayFail(-1);
  return 0;
};
