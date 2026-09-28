// #233: a discard in a generic body is judged by the type its template
// declared. `check` declares a `Result<T, string>`, so dropping it is refused
// at every `T`; `parse` declares a `Result<i32, string>`, so dropping it is
// refused even at `T = Result<i32, string>`, where it has `T`'s type.
const parse = (n: i32): Result<i32, string> => (n < 0 ? Err("negative") : Ok(n));

const check = <T>(value: T): Result<T, string> => Ok(value);

const both = <T>(value: T): void => {
  check(value);
  parse(-1);
};

export const main = (): i32 => {
  both(parse(1));
  return 0;
};
