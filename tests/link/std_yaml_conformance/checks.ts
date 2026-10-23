// The comparer held to known answers, so a pass means what it says.
import { Suite } from "nish/testing";
import { YcCase } from "./cases";
import { YC_NODE_BUDGET } from "./compare";
import { ycJsonDocument, ycVerdict } from "./run";

const ycCheckWith = (t: Suite, name: string, yaml: string, json: string, budget: i32, wanted: string): void => {
  const why = ycVerdict(new YcCase(name, false, yaml, json), ycJsonDocument(), budget);
  if (wanted === "") {
    t.eqStr(`comparer: ${name}`, why, "");
  } else {
    t.ok(`comparer: ${name}`, toI32(why.indexOf(wanted)) >= 0);
  }
};

const ycCheck = (t: Suite, name: string, yaml: string, json: string, wanted: string): void => {
  ycCheckWith(t, name, yaml, json, YC_NODE_BUDGET, wanted);
};

export const ycComparerChecks = (t: Suite): void => {
  ycCheck(t, "scalars match by type", "a: 1\nb: true\nc: ~\nd: x\ne: 0x10\n", '{"a":1,"b":true,"c":null,"d":"x","e":16}', "");
  ycCheck(t, "a quoted number is a string", 'a: "1"\n', '{"a":1}', "$0.a: expected 1");
  ycCheck(t, "keys match in any order", "a: 1\nb: 2\n", '{"b":2,"a":1}', "");
  ycCheck(t, "a missing key differs", "a: 1\n", '{"a":1,"b":2}', "expected 2 keys, got 1");
  ycCheck(t, "a sequence matches in order", "- 1\n- 2\n", "[2,1]", "$0[0]: expected 2");
  ycCheck(t, "aliases are followed", "a: &x [1]\nb: *x\n", '{"a":[1],"b":[1]}', "");
  ycCheck(t, "merge keys are applied", "a: &x {k: 1, m: 2}\nb:\n  <<: *x\n  k: 3\n", '{"a":{"k":1,"m":2},"b":{"k":3,"m":2}}', "");
  ycCheck(t, "documents are counted", "--- 1\n--- 2\n", "1 2 3", "expected 3 documents, got 2");
  // An alias is walked each time it is used: 14 nodes here, the map, a and its 3, b and twice 4.
  ycCheckWith(t, "aliases count against the budget", "a: &a [1, 2, 3]\nb: [*a, *a]\n", '{"a":[1,2,3],"b":[[1,2,3],[1,2,3]]}', 9, "more than 9 nodes");
  ycCheckWith(t, "a walk within the budget passes", "a: &a [1, 2, 3]\nb: [*a, *a]\n", '{"a":[1,2,3],"b":[[1,2,3],[1,2,3]]}', 15, "");
};
