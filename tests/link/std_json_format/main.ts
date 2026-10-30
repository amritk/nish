// `nish/json-format` (std/json-format.ts): every case of JSON-Schema-Test-Suite's
// draft 2020-12 `optional/format` through the dispatcher, a pass count pinned
// per format, and the edges the suite does not reach.
import { Suite } from "nish/testing";
import { jftSuiteChecks } from "./suite";
import { jftUnits } from "./units";

export const main = (): number => {
  const t = new Suite("std/json-format");
  jftUnits(t);
  jftSuiteChecks(t);
  return t.done();
};
