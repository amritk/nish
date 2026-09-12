// NL2073: An imported function used where a type is expected names the module it came from.
import { one } from "./wordings_lib";

const use = (x: one): i32 => 1;

export const main = (): i32 => 0;
