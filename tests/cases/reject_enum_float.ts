// An enum lowers to `i32`, so a member has to be an integer. Phase 0 already
// refuses everything that is not a numeric literal; this is the literal that
// is numeric and still not a member value.
enum Kind {
  Half = 1.5,
}

export const test = (): i32 => 0;
