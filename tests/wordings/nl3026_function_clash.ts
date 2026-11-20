// NL3026: `hidden` is exported by neither module, and still clashes with
// `nl3_clash/lib.ts`'s under `--no-strict-exports` (this case's `.args`):
// there every function keeps its bare name as its symbol, and the
// whole-program attribute analysis is keyed by symbol. Under the default
// `--strict-exports` each module's `hidden` is qualified by its path (WP57 S1)
// and the program builds.
import { anchor } from "./nl3_clash/lib";

const hidden = (): i32 => 4;

export const main = (): i32 => hidden() + anchor();
