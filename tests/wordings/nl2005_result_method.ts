// NL2005: An unknown method on a `Result` lists the five it does have.
export const main = (): i32 => {
  const r: Result<i32, string> = Ok(1);
  return r.nope();
};
