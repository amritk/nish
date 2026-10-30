// `nish/json-pointer` (std/json-pointer.ts): parse, escape, resolve and the
// form checks, and the JSON-Schema-Test-Suite groups of the `json-pointer` and
// `relative-json-pointer` formats (tests/json-schema-suite) through them.
import { Suite } from "nish/testing";
import { jssRunFile } from "../../json-schema-suite/driver";
import { jpUnits } from "./units";

export const main = (): number => {
  const t = new Suite("std/json-pointer");
  jpUnits(t);
  jssRunFile(t, "optional/format/json-pointer", 40);
  jssRunFile(t, "optional/format/relative-json-pointer", 26);
  return t.done();
};
