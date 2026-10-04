// The root package's `"nish".capabilities.deny` refuses a program whose
// `main` reaches `net` through another module (NL2459), with no flag on the
// command line: the span is `main`'s call, and the chain names each hop.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
