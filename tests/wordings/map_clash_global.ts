// The other module of the NL3030 case: it names the global `Map`, which the
// case itself declares a class of its own for. It is not a case itself:
// `tests/diagnostic_coverage.js` collects only files named for their code.
export const counted = (): i32 => {
  const m = new Map<string, i32>();
  m.set("one", 1);
  return m.size;
};
