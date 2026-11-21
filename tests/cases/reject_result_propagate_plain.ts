// Rule 3: `orReturn()` returns the error from the enclosing function, so that
// function has to admit in its own signature that it can fail.
const mayFail = (n: i32): Result<i32, string> => {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
};

export const main = (): i32 => {
  const value = mayFail(1).orReturn();
  return value;
};
