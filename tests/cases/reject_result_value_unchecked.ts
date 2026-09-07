// Rule 2: the success payload is unreachable until the discriminant has been
// tested, so the success path cannot be written before the error path.
function mayFail(n: i32): Result<i32, string> {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function main(): i32 {
  const outcome = mayFail(1);
  return outcome.value;
}
