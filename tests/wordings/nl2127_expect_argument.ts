// NL2127: `expect(...)` takes the message it panics with, which is a string.
export const main = (): i32 => {
  const r: Result<i32, string> = Ok(1);
  return r.expect(1);
};
