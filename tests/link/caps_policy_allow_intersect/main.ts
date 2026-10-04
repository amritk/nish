// Two allowlists intersect: the root package allows `fs.read` and `env`,
// `--allow fs.read` allows only the first, so reading the environment is
// refused (NL2459), and the refusal names the command line's list.
import { isSet } from "./settings";

export const main = (): number => (isSet("CAPS_POLICY_UNSET_VARIABLE") ? 1 : 0);
