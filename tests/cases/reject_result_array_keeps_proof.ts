// #234: an array literal's element type never carries an element's proof.
// `[r]` inside `if (r.ok)` is a `Result<i32, i32>[]`, so the `Err` pushed
// after it is not read as an ok. Before the fix the element type was `r`'s ok
// state and `arr[1].value` printed the payload of an `Err`.
const parse = (n: i32): Result<i32, i32> => (n > 0 ? Err(7) : Ok(n));

export const main = (): void => {
  const r = parse(-1);
  if (r.ok) {
    const arr = [r];
    arr.push(parse(5));
    const second = arr[1];
    console.log(`${second.value}`);
  }
};
