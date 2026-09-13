// NL2152: An error arm carries a value; the message names the `Result<T, string>` that people want.
export const main = (): i32 => {
  const r: Result<i32, void> = Ok(1);
  return 0;
};
