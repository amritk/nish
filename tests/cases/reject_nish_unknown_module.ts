// `nish:` names the builtin modules and nothing else, so an unknown one is
// reported as a bad module rather than as the missing file it would become if
// it fell through to path resolution.
import { readFileSync } from "nish:sqlite";

export const main = (): number => 0;
