// `--deny` narrows a root package's allowlist: the package allows `env`, the
// command line denies it, and a program that reads it is refused (NL2459).
import { isSet } from "./settings";

export const main = (): number => (isSet("CAPS_POLICY_UNSET_VARIABLE") ? 1 : 0);
