// An escaped key that decodes to neither `"nish"` nor `"capabilities"`, and an
// escape inside a value, change nothing: the policy beside them is honoured
// and the program inside it runs.
import { isSet } from "./settings";

export const main = (): number => {
  console.log(isSet("CAPS_POLICY_UNSET_VARIABLE") ? "set" : "unset");
  return 0;
};
