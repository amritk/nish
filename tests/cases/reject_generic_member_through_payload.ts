// WP18 G6: the builtin members that hand a value back hand back where it came
// from too. A `Result<T, E>`'s `value` is a `T`, `pop()` on a `T[]` is a `T`,
// an assignment's value is its right-hand side, and `this` copied into a local
// is the class at its own parameters. `concrete` does the same at `Point` and
// is accepted: the `4 errors` in the `.err` is what says so.
class Point {
  x: i32 = 2;
}

class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  viaThis(): i32 {
    const me = this;
    return me.value.x;
  }
}

const viaResult = <T>(r: Result<T, string>): i32 => {
  if (r.isOk()) {
    return r.value.x;
  }
  return 0;
};

const viaPop = <T>(xs: T[]): i32 => xs.pop().x;

const viaAssignment = <T>(t: T, u: T): i32 => {
  let q = u;
  return (q = t).x;
};

const found = (p: Point): Result<Point, string> => Ok(p);

const concrete = (p: Point): i32 => {
  const r = found(p);
  const xs: Point[] = [p];
  let q = p;
  return (r.isOk() ? r.value.x : 0) + xs.pop().x + (q = p).x;
};

export const test = (): number => {
  const p = new Point();
  return viaResult(found(p)) + viaPop([p]) + viaAssignment(p, p) + new Box<Point>(p).viaThis() + concrete(p);
};
