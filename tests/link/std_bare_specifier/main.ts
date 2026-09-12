// The standard library reached by its package specifier instead of by a path
// up the tree: `nish/testing` and `nish/text` are the same two modules
// `std_text` imports as `../../../std/testing`, resolved from beside the
// compiler rather than from this directory.
//
// That is the whole of the case, so the assertions are deliberately thin — the
// two libraries have their own cases — and what it proves is that the module
// arrived: a `Suite` that runs and a `trim` that trims are a module compiled
// and linked, which a resolver that answered the wrong file could not fake.
import { Suite } from "nish/testing";
import { contains, trim } from "nish/text";

export const main = (): number => {
  const t = new Suite("nish/ specifier");
  t.eqStr("trim", trim("  padded  "), "padded");
  t.ok("contains", contains("haystack", "stack"));
  return t.done();
};
