// Rule 3 again: the propagated error has to fit the enclosing function's error
// arm. There is no implicit conversion (Rust's `From<E>` needs a trait, and
// Nish has none), so the mismatch is named rather than papered over.
interface IoError {
  code: i32;
}

function open(path: string): Result<i32, IoError> {
  if (path === "") {
    const problem: IoError = { code: 2 };
    return Err(problem);
  }
  return Ok(3);
}

export function read(path: string): Result<i32, string> {
  const fd = open(path).orReturn();
  return Ok(fd);
}
