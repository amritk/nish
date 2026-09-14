// A module that exports a generic class, for `nl2316_generic_class_import`.
// It is not a case itself: `tests/diagnostic_coverage.js` only collects files
// named for the code they pin.
export class Crate<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}
