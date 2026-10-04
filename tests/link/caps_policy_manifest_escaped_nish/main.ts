// A policy key written with a JSON escape is refused where it is written
// (NL3032): the manifest reader does not decode escapes, so it would not see
// the `deny` the key holds, and the program that reaches `net` would compile.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
