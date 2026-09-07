// `Result<void, E>`: a fallible operation with nothing to hand back. The struct
// has no `value` field at all, so the golden's type is `{ i1, i8* }`.
function checkPort(port: i32): Result<void, string> {
  if (port <= 0) {
    return Err("port must be positive");
  }
  return Ok();
}

export function main(): i32 {
  const bad = checkPort(0);
  if (bad.isErr()) {
    console.log(bad.error);
  }
  checkPort(443).expect("443 is a port");
  console.log("done");
  return 0;
}
