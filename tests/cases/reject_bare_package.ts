// The two bare forms are `nish:` and `nish/`, and nothing else: there is no
// package resolution yet (docs/wp21-packages.md section 5b), so an ordinary
// npm specifier is still refused.
import { chunk } from "lodash";

export const main = (): number => 0;
