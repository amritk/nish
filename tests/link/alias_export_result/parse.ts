export type Message = string;

// A `Result` alias whose error type is another alias.
export type Parsed = Result<i32, Message>;

export const digit = (c: string): Parsed => {
  const code = c.charCodeAt(0);
  if (code < 48 || code > 57) {
    return Err(`not a digit: ${c}`);
  }
  return Ok(code - 48);
};
