// A `readonly T[]` parameter that escapes — returned here, and stored into a
// field — is still `const` on the C prototype. That is not obvious from the
// attribute fixpoint: `writesThrough` is a conservative *may-write* that every
// escape sets, on the grounds that an alias might be written through later. The
// header does not consult it for a `readonly` parameter, because the checker
// already refuses every write and is exact where the fixpoint is not. Before
// this case existed, the two disagreed and the compiler aborted with exit 70 on
// a program the checker had just accepted.
class Window {
  rows: readonly i32[];

  constructor(rows: readonly i32[]) {
    this.rows = rows;
  }
}

export function first(xs: readonly i32[]): readonly i32[] {
  return xs;
}

export function hold(xs: readonly i32[]): i32 {
  const w = new Window(xs);
  return w.rows.length;
}

// Shallow, so the inner array is an ordinary mutable `i32[]` and storing into
// it is legal; the outer header is still never written through.
export function touch(rows: readonly i32[][], v: i32): i32 {
  rows[0][0] = v;
  return rows.length;
}
