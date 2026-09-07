// `Result` is a built-in type constructor with exactly two arguments, in the
// same way `Array<T>` has exactly one.
export function mayFail(n: i32): Result<i32> {
  return Ok(n);
}
