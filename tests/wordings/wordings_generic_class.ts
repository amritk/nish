// A module that exports a generic class, and a plain one beside it, for the
// cases that need a template or a non-template on the other side of an import.
// It is not a case itself: `tests/diagnostic_coverage.js` only collects files
// named for the code they pin.
export class Crate<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

export class Plain {
  value: i32 = 0;
}
