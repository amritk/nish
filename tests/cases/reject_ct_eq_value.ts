// WP34 N6: ctEq is a builtin, and no function in the language is a value (NL2248).
export const f = (): i32 => {
  const g = ctEq;
  return 0;
};
