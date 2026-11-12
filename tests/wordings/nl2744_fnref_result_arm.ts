// NL2744: a function reference directly in a `Result` arm, which is not a
// place a reference's set is built from.
type F = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;

const pick = (): Result<F, string> => Ok(inc);

export const main = (): i32 => {
  const r = pick();
  return r.ok ? 1 : 0;
};
