// WP18 §6.1: `Result<T, E>` stays built-in, and a type argument is an ordinary
// type — so a generic function over a `Result` payload needs no special case in
// either direction. `orElse<i32>` takes the WP17 packed word and unpacks it
// with the code a hand-written `orElse` would have used.
const orElse = <T>(r: Result<T, string>, fallback: T): T => {
  if (r.ok) {
    return r.value;
  }
  return fallback;
};

const halve = (n: i32): Result<i32, string> => (n % 2 === 0 ? Ok(n / 2) : Err("odd"));

export const test = (): number => {
  console.log(orElse(halve(8), 0 - 1));
  console.log(orElse(halve(7), 0 - 1));
  return 0;
};
