// `unwrapOr` handles the failure with a value and meets in a `phi`; `expect`
// handles it by ending the process, so its error arm is `unreachable` after the
// same stderr write and `nish_exit(1)` a `panic` lowers to.
function parsePort(text: string): Result<i32, string> {
  const n = parseInt(text);
  if (n <= 0) {
    return Err("not a port");
  }
  return Ok(n);
}

export function main(): i32 {
  console.log(parsePort("nope").unwrapOr(-1));
  console.log(parsePort("8080").expect("8080 is a port"));
  return 0;
}
