// --deny-panics refuses `expect`, and names `orReturn` and `unwrapOr`.
const parse = (s: string): Result<i32, string> => {
  if (s.length === 0) {
    return Err("empty");
  }
  return Ok(toI32(s.length));
};

export const strict = (s: string): i32 => parse(s).expect("a non-empty string");
