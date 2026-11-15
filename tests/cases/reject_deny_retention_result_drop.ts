// --deny-retention: NL9016 on a `Result`, a box dropped on every pass of a
// loop, is an error.
export const main = (): void => {
  let r: Result<i32, string> = Ok(0);
  for (let i = 0; i < 1000; i++) {
    if (r.isErr()) {
      break;
    }
    r = Ok(i);
  }
  console.log(r.unwrapOr(-1));
};
