// #235, the `Result` twin: `r = parse(5)` runs after `r.ok` was tested, so
// the proof ends there and `r.value` in the last operand is refused. The same
// rule holds for the then-branch of the `if`.
const parse = (n: i32): Result<i32, i32> => (n > 0 ? Err(7) : Ok(n));

const g = (b: boolean): boolean => b;

export const main = (): void => {
  let r = parse(-1);
  if (r.ok && g((r = parse(5)).isErr()) && r.value === 0) {
    console.log("x");
  }
};
