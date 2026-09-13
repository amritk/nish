// NL2126: `Err(...)` carries the error arm's type, and the message names both types.
export const main = (): i32 => {
  const r: Result<i32, string> = Err(1);
  return 0;
};
