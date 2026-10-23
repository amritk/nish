// `nish/yaml` (std/yaml.ts) and `nish/yaml-lines` (std/yaml-lines.ts): every
// feature on the smallest input that shows it, and every diagnostic code with
// its kind and exact byte range.
import { Suite } from "../../../std/testing";
import { ytNegatives } from "./negatives";
import { ytReport } from "./report";
import { ytUnits } from "./units";

export const main = (): number => {
  const t = new Suite("std/yaml");
  ytUnits(t);
  ytNegatives(t);
  ytReport();
  return t.done();
};
