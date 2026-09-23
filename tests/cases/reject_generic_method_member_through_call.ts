// WP18 G8 (§15.6 through a method): a generic method's result is whatever its
// argument was, so `id.same(t)` is still a `T` and `.area` through it is a
// member of an unconstrained parameter. Without following the call, the
// instantiation at `Point` would read the field in silence. `plain` does the
// same at a declared `Point` and must be accepted.
class Point {
  area: i32 = 1;
}

class Id {
  tag: i32 = 0;

  same<V>(v: V): V {
    return v;
  }
}

const plain = (p: Point, id: Id): i32 => id.same(p).area;

const areaOf = <T>(t: T, id: Id): i32 => id.same(t).area;

export const test = (): number => plain(new Point(), new Id()) + areaOf(new Point(), new Id());
