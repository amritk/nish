// A capture is read through the narrowing in force at the call: `name` is
// `string | null` in `greet`, `string` once the `if` has ruled out null, and
// the arrow, lifted to a function of its own, still reads it as `string`.
const each = (xs: string[], f: (x: string) => void): void => {
  for (const x of xs) f(x);
};

const twice = <T>(f: (x: T) => T, x: T): T => f(f(x));

const greet = (xs: string[], name: string | null, bang: string): void => {
  if (name !== null) {
    each(xs, (x) => {
      console.log(`${x}, ${name} (${name.length})`);
    });
  }
  const tag = `${bang}${bang}`;
  console.log(twice((s: string) => `${s}${tag}`, "hey"));
  console.log(`${twice((n: i32) => n * tag.length + 1, 2)}`);
};

export const main = (): i32 => {
  greet(["hi", "bye"], "Ada", "!");
  greet(["skipped"], null, "?");
  return 0;
};
