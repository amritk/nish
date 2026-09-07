export interface ParseError {
  offset: i32;
  reason: string;
}

// The importer never writes `ParseError`, and still reads one out of the
// `Result` this hands back: a `Result` drags both payload layouts across the
// module boundary the way a class's method signature does (WP16).
export function parseDigit(text: string, at: i32): Result<i32, ParseError> {
  if (at >= text.length) {
    const problem: ParseError = { offset: at, reason: "end of input" };
    return Err(problem);
  }
  const code = text.charCodeAt(at);
  if (code < 48 || code > 57) {
    const problem: ParseError = { offset: at, reason: "not a digit" };
    return Err(problem);
  }
  return Ok(code - 48);
}
