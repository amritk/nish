// Rule 1, the other half: binding the `Result` and never reading it ignores
// the failure just as thoroughly as dropping it.
function mayFail(n: i32): Result<i32, string> {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function main(): i32 {
  const outcome = mayFail(-1);
  return 0;
}
