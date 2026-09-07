// A `Result` is built once and read afterwards; there is no way to flip the
// discriminant out from under a narrowing.
function mayFail(n: i32): Result<i32, string> {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function main(): i32 {
  const outcome = mayFail(1);
  outcome.ok = false;
  return 0;
}
