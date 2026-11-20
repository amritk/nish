// WP66: a C struct layout another module exports is still lent only to a
// `declare function`: an exported Nish function of this module may not take
// one, since no header, `.d.ts` or N-API binding describes it (NL2756).
import { TallyOut } from "./tally"

export const peek = (out: TallyOut): i64 => out.value

export const main = (): i32 => 0
