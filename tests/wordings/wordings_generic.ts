// A module that exports a generic function, for the one case that needs a
// template on the other side of an import (`nl2298_generic_import`). It is not
// a case itself: `tests/diagnostic_coverage.js` only collects files named for
// the code they pin, the way `wordings_lib.ts` sits here without being one.
export const identity = <T>(x: T): T => x;
