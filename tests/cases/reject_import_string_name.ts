// An export is a declaration and has the declaration's name, so a name written
// as a string asks for one no module can have.
import { "twice" as double } from "./locals";

export const run = (): number => double(2);
