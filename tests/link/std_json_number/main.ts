// `nish/json-number` (std/json-number.ts): exact comparison, canonical text
// and multipleOf on number text, every refusal, and the JSON-Schema-Test-Suite
// groups of the numeric keywords (tests/json-schema-suite) through them.
import { Suite } from "nish/testing";
import { jssRunFile } from "../std_json_equal/suite";
import { jnUnits } from "./units";

export const main = (): number => {
  const t = new Suite("std/json-number");
  jnUnits(t);
  jssRunFile(t, "multipleOf", 11);
  jssRunFile(t, "minimum", 11);
  jssRunFile(t, "maximum", 8);
  jssRunFile(t, "exclusiveMinimum", 4);
  jssRunFile(t, "exclusiveMaximum", 4);
  jssRunFile(t, "optional/bignum", 9);
  jssRunFile(t, "optional/float-overflow", 1);
  return t.done();
};
