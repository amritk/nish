// `nish/json-equal` (std/json-equal.ts): equality, canonical text, hash and
// first duplicate, and the JSON-Schema-Test-Suite groups of `const`, `enum`
// and `uniqueItems` (tests/json-schema-suite) through them.
import { Suite } from "nish/testing";
import { jssRunFile } from "../../json-schema-suite/driver";
import { jeUnits } from "./units";

export const main = (): number => {
  const t = new Suite("std/json-equal");
  jeUnits(t);
  jssRunFile(t, "const", 54);
  jssRunFile(t, "enum", 53);
  jssRunFile(t, "uniqueItems", 69);
  return t.done();
};
