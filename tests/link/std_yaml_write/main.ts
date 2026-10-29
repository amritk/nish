// `nish/yaml-write` (std/yaml-write.ts): every clause of the quoting rule as a
// value and as a key, the escapes, whole documents written exactly and read
// back by parseYaml as the same tree, the explicit key, the depth limit and
// what is refused.
import { Suite } from "../../../std/testing";
import { ywDocuments } from "./documents";
import { ywQuoting } from "./quoting";

export const main = (): number => {
  const t = new Suite("std/yaml-write");
  ywQuoting(t);
  ywDocuments(t);
  return t.done();
};
