// NL2006: An unknown property on a `Result` lists the three it does have.
export const main = (): i32 => {
  const r: Result<i32, string> = Ok(1);
  return r.nope;
};
