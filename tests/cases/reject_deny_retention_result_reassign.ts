// --deny-retention: NL9003 on a `Result`, a box assigned over a box inside a
// loop, is an error.
export const main = (): void => {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    let r: Result<i32, string> = Ok(i);
    if (r.isOk()) {
      r = Ok(i * 2);
    }
    total = total + r.unwrapOr(0);
  }
  console.log(total);
};
