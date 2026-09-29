// The duplicate import where the second names a function: the enum is bound
// before any function import, and the function import is the second binding.
import { Kind } from "./kinds";
import { Kind } from "./make";

export const main = (): number => 0;
