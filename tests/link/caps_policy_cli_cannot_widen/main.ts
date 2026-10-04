// The command line can only narrow the root package's policy: `--allow net`
// does not grant back the `net` its `package.json` denies (NL2459).
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
