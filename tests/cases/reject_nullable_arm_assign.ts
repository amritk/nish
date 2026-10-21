// Only the then-arm falls through, and it assigns `q` a value that may be
// `null`, so after the `if` `q` is nullable again, as TypeScript says.
class Box {
  a: i32 = 1;
}

const f = (p: Box | null, r: Box | null): i32 => {
  let q: Box | null = p;
  if (q !== null) {
    q = r;
  } else {
    return 0;
  }
  return q.a;
};

export const main = (): void => {
  console.log(f(new Box(), null));
};
