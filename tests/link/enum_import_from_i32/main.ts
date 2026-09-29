// Nor does an `i32` convert to an imported enum, at an argument of the module
// that declared it.
import { weight } from "./kinds";

export const main = (): number => weight(2);
