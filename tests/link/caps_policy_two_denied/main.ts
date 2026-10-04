// One error per refused capability (NL2459, twice), each at its own first
// call, reported in source order like every diagnostic: `net` here before
// `env`, though `env` is first in the capability set (`expected.json` pins
// both objects).
import { dial } from "./client";
import { isSet } from "./settings";

export const main = (): number => {
  if (dial(8080)) {
    return 1;
  }
  return isSet("CAPS_POLICY_UNSET_VARIABLE") ? 2 : 0;
};
