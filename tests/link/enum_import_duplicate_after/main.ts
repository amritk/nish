// The function import is written first, so it is the binding and the enum
// import below it is the duplicate, although the enum is bound first.
import { Kind } from "./make";
import { Kind } from "./kinds";

export const main = (): number => Kind();
