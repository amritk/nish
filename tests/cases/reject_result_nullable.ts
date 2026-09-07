// `Result<T, E> | null` would be two ways to say "no value"; the error arm
// already is one.
function mayFail(n: i32): Result<i32, string> {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function main(): i32 {
  const outcome: Result<i32, string> | null = mayFail(1);
  return 0;
}
