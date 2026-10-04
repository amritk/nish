// The command line cannot widen the root package's allowlist: `--allow
// fs.read,env` over a package that allows only `fs.read` still refuses `env`
// (NL2459), and the refusal names the package's list.
import { isSet } from "./settings";

export const main = (): number => (isSet("CAPS_POLICY_UNSET_VARIABLE") ? 1 : 0);
