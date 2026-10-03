// WP35: a generic is judged per instantiation. `pick<i32, double>` and
// `pick<string, firstLine>` are two functions with two sets: the first
// reaches nothing, the second `fs.read`. A type argument changes what a body
// calls only through a function parameter, since a class constraint is
// satisfied by that class alone, so the two differ in both.
export const pick = <T>(x: T, f: (v: T) => T): T => f(x);

const double = (n: i32): i32 => n * 2;

const firstLine = (path: string): string => {
  const text = readFileSync(path);
  const end = text.indexOf("\n");
  return end < 0 ? text : text.substring(0, end);
};

export const main = (): number => {
  console.log(pick(21, double));
  console.log(pick("tests/cases/caps_generic.ts", firstLine).length > 0);
  return 0;
};
