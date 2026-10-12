// The default of `??` on a `T | null` takes its type from `T`, so an empty
// array and an object literal need no annotation; a bare `null`, or a ternary
// that may answer one, is checked into `T | null` and keeps the result
// nullable.
interface Named {
  name: string;
}

const firstOrEmpty = (xs: i32[] | null): i32[] => xs ?? [];

const named = (n: Named | null): Named => n ?? { name: "literal" };

const either = (a: string | null, b: string | null, c: boolean): string | null => a ?? (c ? b : null);

const orNull = (a: string | null): string | null => a ?? null;

export const main = (): i32 => {
  const ys = firstOrEmpty(null);
  ys.push(4);
  const e = either(null, "b", true);
  const f = either(null, "b", false);
  const g = orNull(null);
  console.log(`${ys.length} ${named(null).name} ${e === null ? "none" : e} ${f === null ? "none" : f} ${g === null}`);
  return 0;
};
