// An escaped key that cannot decode to `"nish"` or `"capabilities"`, and an
// escape inside a value, are read as they always were: the policy beside them
// is honoured and the program inside it runs.
import { isSet } from "./settings";

export const main = (): number => {
  console.log(isSet("CAPS_POLICY_UNSET_VARIABLE") ? "set" : "unset");
  return 0;
};
