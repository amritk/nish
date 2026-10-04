// A capability name written with a JSON escape is decoded as JSON.parse
// decodes it, so the `deny` names `net` and the program that reaches it is
// refused (NL2459).
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
