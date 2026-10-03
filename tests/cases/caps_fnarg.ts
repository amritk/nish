// WP35: a function parameter is an instantiation per callee, so `apply` given
// `lengthOf` and `apply` given an arrow that reads the environment are two
// entries with two sets: none, and `env` through the lifted arrow.
export const apply = (f: (s: string) => i32, s: string): i32 => f(s);

const lengthOf = (s: string): i32 => s.length;

export const main = (): number => {
  console.log(apply(lengthOf, "four"));
  console.log(
    apply((name) => {
      const value = getenv(name);
      return value === null ? -1 : value.length;
    }, "NISH_CAPS_FNARG")
  );
  return 0;
};
