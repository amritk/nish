// A program inside the root package's policy (an allowlist of `env`, and two
// denials it never reaches) compiles and runs as it would with no policy.
import { isSet } from "./settings";

export const main = (): number => {
  console.log(isSet("CAPS_POLICY_UNSET_VARIABLE") ? "set" : "unset");
  return 0;
};
