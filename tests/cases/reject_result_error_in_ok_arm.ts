// Rule 2 the other way round: `error` only holds a value where the call failed,
// so reading it inside the success arm is rejected.
function mayFail(n: i32): Result<i32, string> {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function main(): i32 {
  const outcome = mayFail(1);
  if (outcome.isOk()) {
    console.log(outcome.error);
  }
  return 0;
}
