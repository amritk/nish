// #234: a variable's inferred type never carries its initialiser's proof.
// `let y = r` inside `if (r.ok)` is a `Result<i32, i32>`, so after `y` is
// assigned an `Err` its `value` is refused. Before the fix `y` was declared
// with `r`'s ok state and the assignment kept it.
const parse = (n: i32): Result<i32, i32> => (n > 0 ? Err(7) : Ok(n));

export const main = (): void => {
  const r = parse(-1);
  if (r.ok) {
    let y = r;
    console.log(`${y.ok}`);
    y = parse(5);
    console.log(`${y.value}`);
  }
};
