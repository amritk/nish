// NL2072: An imported constant used where a type is expected names the module it came from.
import { LIMIT } from "./wordings_lib";

const use = (x: LIMIT): i32 => 1;

export const main = (): i32 => 0;
