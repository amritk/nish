// A module that exports a generic function, for the two cases that need a
// template on the other side of an import: `nl2298_generic_import`, which
// imports the template itself, and `nl3010_generic_redeclared`, which imports
// `anchor` only so that this module is loaded and its `identity` meets the one
// declared there. It is not a case itself: `tests/diagnostic_coverage.js` only
// collects files named for the code they pin, the way `wordings_lib.ts` sits
// here without being one.
export const identity = <T>(x: T): T => x;

export const anchor = (): i32 => 1;
