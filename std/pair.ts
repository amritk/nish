/**
 * `std/pair` — two values answered by one call.
 *
 * It exists for the function that has two things to say, like the lexer's
 * `scanEscape`: where an escape ended, and whether it was malformed. Without a
 * pair, the second answer lives in a field on some object, written by the
 * callee and read back by the caller three lines later. With one, both come
 * back in the return:
 *
 *     import { Pair } from "nish/pair";
 *
 *     const scanEscape = (at: i32): Pair<i32, boolean> => ({ first: at + 2, second: true });
 *
 * It is **for returning two values, not for storing them**. A struct held in an
 * array or a class field should have named fields, and parallel arrays are the
 * house style for two values side by side (`docs/wp15-performance.md` §1a), so
 * a `Pair[]` is usually the slower shape and the less readable one.
 *
 * It is an `interface` rather than a class, so there is no constructor to call
 * and nothing to import but the type: an object literal takes its type from the
 * annotation, and the checker holds it to setting `first` and `second` exactly
 * once each. There is no tuple syntax behind it and no special case in the
 * compiler; `docs/wp23-language-surface.md` §5 is the argument for that.
 */
export interface Pair<A, B> {
  first: A;
  second: B;
}
