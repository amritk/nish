// #234: a ternary's type never carries an arm's proof. `r` is narrowed to ok
// and `q` to err; the arms' types differ only in that proof, so `z` is a plain
// `Result` and reading its `value` needs a test of `z` itself. Before the fix
// `z` took `r`'s ok state and printed the payload of `Err(7)`.
const parse = (n: i32): Result<i32, i32> => (n > 0 ? Err(7) : Ok(n));

export const main = (): void => {
  const r = parse(-1);
  const q = parse(4);
  if (r.ok) {
    if (q.isErr()) {
      const z = r.value > 0 ? r : q;
      console.log(`${z.value}`);
    }
  }
};
